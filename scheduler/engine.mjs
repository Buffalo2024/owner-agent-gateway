import {randomUUID,createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {dirname} from 'node:path';
import {assert,only,identifier,capability,validate} from '../protocol/validation.mjs';
export const hash=v=>createHash('sha256').update(typeof v==='string'?v:canonical(v)).digest('hex');
export function canonical(v){if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';return JSON.stringify(v)}
const final=s=>['SUCCEEDED','FAILED','CANCELLED'].includes(s);
export class Engine {
 constructor({file=null,clock=()=>Date.now(),leaseMs=15000,maxTasks=10000}={}){this.file=file;this.clock=clock;this.leaseMs=leaseMs;this.maxTasks=maxTasks;this.state={agents:{},tasks:{},keys:{},audit:[]};this.serial=Promise.resolve()}
 async open(){if(this.file)try{this.state=JSON.parse(await readFile(this.file,'utf8'));assert(this.state.agents&&this.state.tasks&&this.state.keys&&Array.isArray(this.state.audit),'INVALID_STATE')}catch(e){if(e.code!=='ENOENT')throw e}return this}
 async tx(fn){const run=this.serial.then(async()=>{const before=structuredClone(this.state);try{const result=fn();if(this.file){await mkdir(dirname(this.file),{recursive:true,mode:0o700});const tmp=this.file+'.tmp';await writeFile(tmp,JSON.stringify(this.state),{mode:0o600});await rename(tmp,this.file)}return structuredClone(result)}catch(e){this.state=before;throw e}});this.serial=run.catch(()=>{});return run}
 event(kind,t=null,agent=null){this.state.audit.push({at:new Date(this.clock()).toISOString(),kind,taskId:t?.id??null,agentId:agent??t?.agentId??null,attempt:t?.attempt??null});if(this.state.audit.length>10000)this.state.audit.shift()}
 sweep(){const now=this.clock();for(const t of Object.values(this.state.tasks)){
  if(final(t.status))continue;
  if(t.deadlineAt<=now){t.status='FAILED';t.error='DEADLINE_EXCEEDED';t.lease=null;this.event('deadline',t);continue}
  if(t.lease&&(t.lease.expiresAt<=now||t.lease.attemptDeadline<=now)){t.status=t.attempt>=t.contract.execution.maxAttempts?'FAILED':'QUEUED';t.error=t.status==='FAILED'?'ATTEMPTS_EXHAUSTED':null;t.lease=null;this.event('lease-expired',t)}
 }}
 async register(owner,v){return this.tx(()=>{only(v,['id','name','capabilities']);identifier(v.id);assert(typeof v.name==='string'&&v.name.length>0&&v.name.length<=200,'INVALID_NAME');assert(Array.isArray(v.capabilities)&&v.capabilities.length>0&&v.capabilities.length<=32,'INVALID_CAPABILITIES');v.capabilities.forEach(capability);assert(new Set(v.capabilities.map(c=>c.id)).size===v.capabilities.length,'DUPLICATE_CAPABILITY');const old=this.state.agents[v.id];assert(!old||old.owner===owner,'FORBIDDEN',403);this.state.agents[v.id]={...structuredClone(v),owner,paused:old?.paused??false,revoked:old?.revoked??false,lastSeenAt:old?.lastSeenAt??null};this.event('registered',null,v.id);return this.publicAgent(this.state.agents[v.id])})}
 publicAgent(a){return {id:a.id,name:a.name,capabilities:a.capabilities,paused:a.paused,revoked:a.revoked,lastSeenAt:a.lastSeenAt,online:!a.paused&&!a.revoked&&a.lastSeenAt!==null&&this.clock()-a.lastSeenAt<30000}}
 async agents(){return this.tx(()=>Object.values(this.state.agents).filter(a=>!a.revoked).map(a=>this.publicAgent(a)))}
 async control(owner,id,action){return this.tx(()=>{const a=this.state.agents[id];assert(a&&a.owner===owner,'NOT_FOUND',404);assert(['pause','resume','revoke'].includes(action),'INVALID_ACTION');assert(!a.revoked||action==='revoke','REVOKED_CONNECTION_REQUIRES_NEW_ID',409);if(action==='pause')a.paused=true;if(action==='resume')a.paused=false;if(action==='revoke'){a.revoked=true;a.paused=true;for(const t of Object.values(this.state.tasks))if(t.agentId===id&&!final(t.status)){t.status='CANCELLED';t.lease=null;this.event('revoked-task',t)}}this.event(action,null,id);return this.publicAgent(a)})}
 async submit(caller,key,v){return this.tx(()=>{this.sweep();identifier(key);only(v,['agentId','capabilityId','capabilityVersion','input','deadlineSeconds']);identifier(v.agentId);identifier(v.capabilityId);identifier(v.capabilityVersion);const h=hash(v),slot=hash([caller,key]),previous=this.state.keys[slot];if(previous){assert(previous.hash===h,'IDEMPOTENCY_CONFLICT',409);return this.view(this.state.tasks[previous.taskId])}
  assert(Object.keys(this.state.tasks).length<this.maxTasks,'TASK_CAPACITY_REACHED',429);
  const a=this.state.agents[v.agentId];assert(a&&!a.revoked,'AGENT_NOT_FOUND',404);assert(!a.paused,'AGENT_PAUSED',409);
  const c=a.capabilities.find(x=>x.id===v.capabilityId&&x.version===v.capabilityVersion);assert(c,'CAPABILITY_NOT_FOUND',404);validate(c.inputSchema,v.input);
  const deadlineSeconds=v.deadlineSeconds??3600;assert(Number.isInteger(deadlineSeconds)&&deadlineSeconds>=1&&deadlineSeconds<=86400,'INVALID_DEADLINE');
  const t={id:randomUUID(),caller,agentId:a.id,capabilityId:c.id,capabilityVersion:c.version,contract:structuredClone(c),input:structuredClone(v.input),status:'QUEUED',attempt:0,createdAt:this.clock(),deadlineAt:this.clock()+deadlineSeconds*1000,lease:null,result:null,receipt:null,error:null};this.state.tasks[t.id]=t;this.state.keys[slot]={hash:h,taskId:t.id};this.event('submitted',t);return this.view(t)})}
 view(t){return {id:t.id,agentId:t.agentId,capabilityId:t.capabilityId,capabilityVersion:t.capabilityVersion,status:t.status,attempt:t.attempt,createdAt:t.createdAt,deadlineAt:t.deadlineAt,error:t.error,result:t.status==='SUCCEEDED'?t.result:null}}
 async get(caller,id){return this.tx(()=>{this.sweep();const t=this.state.tasks[id];assert(t&&t.caller===caller,'NOT_FOUND',404);return this.view(t)})}
 async cancel(caller,id){return this.tx(()=>{const t=this.state.tasks[id];assert(t&&t.caller===caller,'NOT_FOUND',404);assert(!final(t.status)||t.status==='CANCELLED','ALREADY_TERMINAL',409);t.status='CANCELLED';t.lease=null;this.event('cancelled',t);return this.view(t)})}
 executor(agentId){const a=this.state.agents[agentId];assert(a&&!a.revoked,'EXECUTOR_REVOKED',403);return a}
 async claim(agentId,key){return this.tx(()=>{this.sweep();identifier(key);const a=this.executor(agentId);a.lastSeenAt=this.clock();
  const existing=Object.values(this.state.tasks).find(t=>t.agentId===agentId&&t.lease?.claimKey===key);if(existing)return this.assignment(existing);
  if(a.paused)return null;
  const t=Object.values(this.state.tasks).find(t=>t.agentId===agentId&&t.status==='QUEUED'&&Object.values(this.state.tasks).filter(x=>x.agentId===agentId&&x.capabilityId===t.capabilityId&&x.lease&&!final(x.status)).length<t.contract.execution.maxConcurrency);
  if(!t)return null;t.attempt++;t.status='CLAIMED';t.lease={id:randomUUID(),claimKey:key,expiresAt:this.clock()+this.leaseMs,attemptDeadline:this.clock()+t.contract.execution.timeoutSeconds*1000};this.event('claimed',t);return this.assignment(t)})}
 assignment(t){return {taskId:t.id,attempt:t.attempt,leaseId:t.lease.id,leaseExpiresAt:t.lease.expiresAt,attemptDeadline:t.lease.attemptDeadline,capability:structuredClone(t.contract),input:structuredClone(t.input)}}
 leased(agentId,id,v){this.sweep();this.executor(agentId);const t=this.state.tasks[id];assert(t&&t.agentId===agentId,'NOT_FOUND',404);assert(t.lease&&!final(t.status)&&t.attempt===v.attempt&&t.lease.id===v.leaseId,'STALE_LEASE',409);return t}
 async heartbeat(agentId,id,v){return this.tx(()=>{only(v,['attempt','leaseId']);const t=this.leased(agentId,id,v);t.status='RUNNING';t.lease.expiresAt=Math.min(this.clock()+this.leaseMs,t.lease.attemptDeadline,t.deadlineAt);this.state.agents[agentId].lastSeenAt=this.clock();return {leaseExpiresAt:t.lease.expiresAt,cancelRequested:false}})}
 async finish(agentId,id,v){return this.tx(()=>{only(v,['attempt','leaseId','submissionId','result','error']);identifier(v.submissionId);assert(Object.hasOwn(v,'result')!==Object.hasOwn(v,'error'),'INVALID_COMPLETION');this.executor(agentId);const t=this.state.tasks[id];assert(t&&t.agentId===agentId,'NOT_FOUND',404);const h=hash(v);if(t.receipt?.id===v.submissionId){assert(t.receipt.hash===h,'IDEMPOTENCY_CONFLICT',409);return this.view(t)}
  this.leased(agentId,id,v);
  if(v.error!==undefined){assert(['EXECUTION_ERROR','TIMEOUT','INPUT_UNUSABLE','ADAPTER_UNAVAILABLE'].includes(v.error),'INVALID_ERROR');t.status='FAILED';t.error=v.error}else{validate(t.contract.outputSchema,v.result);t.status='SUCCEEDED';t.result=structuredClone(v.result)}
  t.receipt={id:v.submissionId,hash:h};t.lease=null;this.event('finished',t);return this.view(t)})}
 async audit(owner){return this.tx(()=>this.state.audit.filter(e=>e.agentId&&this.state.agents[e.agentId]?.owner===owner))}
}
