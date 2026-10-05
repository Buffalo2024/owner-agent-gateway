// Historical deployed bridge reference; see ../README.md for dependencies and limits.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { AgentRunRequestV1, AgentRunEventV1 } from '../../contracts/src/agent.ts';
import { signAgentRequest } from '../../agent-runtime/src/auth.ts';
import { DotsBridgeService, terminal } from './service.ts';
import { encryptSecret, decryptSecret } from './events.ts';
import { BridgeError, inputContract, requireThat, requireSourceOnlyResult, sha256Canonical, uuid } from './contracts.ts';
import { dotsCapabilityCard } from './capability-card.ts';

// Standard Agent API adapter. No mini-program branch or alternative task flow.
export class DotsPlatformAgent {
 constructor(private service:DotsBridgeService, private config:{owner:string;secret:string;encryptionKey:string;endpointBase:string;callbackOrigin:string},private send:typeof fetch=fetch) {}
 private signedProtocol(raw:string,signature:string,protocol:string) {
  requireThat(this.config.secret.length>=32,'PLATFORM_AGENT_DISABLED',503);
  const expected=Buffer.from(createHmac('sha256',this.config.secret).update(raw).digest('hex')),actual=Buffer.from(signature);
  requireThat(expected.length===actual.length&&timingSafeEqual(expected,actual),'AGENT_REQUEST_UNAUTHORIZED',401);
  let v:any;try{v=JSON.parse(raw);}catch{throw new BridgeError('INVALID_JSON',400);}
  requireThat(v.protocolVersion===protocol&&Number.isFinite(Date.parse(v.issuedAt))&&Date.parse(v.issuedAt)<=this.service.now()+30000&&Date.parse(v.expiresAt)>this.service.now()&&Date.parse(v.expiresAt)-this.service.now()<=150000,'PROTOCOL_CHALLENGE_INVALID');
  return v;
 }
 private signedResponse(id:string,value:any) {
  const raw=JSON.stringify(value);return {raw,signature:createHmac('sha256',this.config.secret).update(`${id}.${raw}`).digest('hex')};
 }
 handshake(raw:string,signature:string) {
  const v=this.signedProtocol(raw,signature,'gongshengji.agent-handshake.v1.1');uuid(v.challengeId);
  requireThat(v.expectedAgentKey==='personal-dots'&&typeof v.nonce==='string'&&v.nonce.length>=24,'PROTOCOL_CHALLENGE_INVALID');
  const build=createHash('sha256');for(const file of ['platform-agent.ts','capability-card.ts','http.ts','rpc.ts','service.ts','events.ts','contracts.ts'])build.update(readFileSync(new URL(file,import.meta.url)));
  return this.signedResponse(v.challengeId,{protocolVersion:v.protocolVersion,challengeId:v.challengeId,nonce:v.nonce,generatedAt:new Date(this.service.now()).toISOString(),agent:{agentKey:'personal-dots',displayName:'Personal dots assistant',releaseVersion:'0.3.2',buildFingerprint:build.digest('hex'),endpointBase:this.config.endpointBase,executionMode:'ASYNC',inputSchema:{type:'object',required:['taskContext','requirement']},outputSchema:{type:'object',required:['points'],properties:{points:{type:'array',minItems:1,maxItems:30,items:{type:'string'}}}},runtimeModels:[{provider:'OpenAI ChatGPT dots',modelName:'host-managed (exact model not exposed)',role:'PRIMARY',usagePurpose:'由现有个人助理宿主管理的一般非隐私测试任务执行；未固定模型型号'}],capabilityCard:dotsCapabilityCard}});
 }
 async connectionTest(raw:string,signature:string) {
  const v=this.signedProtocol(raw,signature,'gongshengji.agent-connection-test.v1');uuid(v.testId);
  const owner={userId:this.config.owner,grantId:'standard-connection-test',taskIds:[]};
  const t=await this.service.create(owner,`standard-connection:${v.testId}`,{schemaVersion:'public_text_summary.v1',input:{declaredPublic:true,text:'本测试只处理合成公开文字，用于验证平台标准 Agent 连接。接待与服务器检查任务，执行端仅根据任务正文整理三点摘要并提交候选。结果审核通过后进入平台交付流程，用户可以查看文字结果。测试仅使用此公开合成材料，所有结果均需满足固定输出格式和长度限制。服务器应记录真实执行回执，不能用模拟摘要代替执行端输出。'}},this.service.config.publicExecution?this.config.owner:undefined);
  const existing=await this.service.transaction(s=>({status:s.tasks[t.taskId].status,version:s.tasks[t.taskId].version}));
  if(existing.status==='INPUT_REVIEW')await this.service.review(t.taskId,{expectedVersion:existing.version,decision:'approve'},'platform:synthetic-connection-test');
  const until=Math.min(this.service.now()+75000,Date.parse(v.expiresAt));
  const tId=t.taskId;
  while(this.service.now()<until) {
   const found=await this.service.transaction(s=>{const t=s.tasks[tId];const c=t?.candidates.at(-1);return {status:t?.status,version:t?.version,candidateId:c?.id,points:c?.result?.points};});
   if(['RESULT_REVIEW','COMPLETED'].includes(found.status)&&found.candidateId&&found.points) {
    if(found.status==='RESULT_REVIEW')await this.service.review(t.taskId,{expectedVersion:found.version,decision:'approve',candidateId:found.candidateId},'platform:synthetic-connection-test-result');
    return this.signedResponse(v.testId,{status:'SUCCEEDED',output:{taskId:t.taskId,points:found.points,execution:'REAL_DOTS_TOOL_SUBMISSION'}});
   }
   if(terminal.includes(found.status))break;
   await new Promise(resolve=>setTimeout(resolve,1000));
  }
  const current=await this.service.transaction(s=>s.tasks[t.taskId]?.version);
  await this.service.cancel(owner,t.taskId,{expectedVersion:current});
  return this.signedResponse(v.testId,{status:'FAILED',output:null,error:{code:'REAL_EXECUTOR_RESPONSE_NOT_RECEIVED'}});
 }
 authenticate(timestamp:string,signature:string,raw:string) {
  requireThat(Boolean(this.config.secret),'PLATFORM_AGENT_DISABLED',503);
  requireThat(Number.isFinite(Date.parse(timestamp))&&Math.abs(this.service.now()-Date.parse(timestamp))<=300000,'AGENT_REQUEST_EXPIRED',401);
  const expected=Buffer.from(signAgentRequest(this.config.secret,timestamp,raw)),actual=Buffer.from(signature);
  requireThat(expected.length===actual.length&&timingSafeEqual(expected,actual),'AGENT_REQUEST_UNAUTHORIZED',401);
 }
 async start(request:AgentRunRequestV1) {
  uuid(request.taskRunId);uuid(request.agentVersionId);
  const c=request.taskContext;
  requireThat(request.protocolVersion==='gongshengji.agent.v1'&&c&&(this.service.config.publicExecution||c.userId===this.config.owner)&&(c.priceMinor===4900||c.priceMinor===0)&&c.authorizedActions.includes('EXECUTE_CONFIRMED_TASK'),'TASK_SCOPE_REJECTED',403);
  uuid(c.userId);
  uuid(c.taskId);requireThat(typeof c.confirmationEventId==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(c.confirmationEventId),'INVALID_CONFIRMATION_EVENT_ID');
  requireThat(/^[a-f0-9]{64}$/.test(c.snapshotHash)&&c.inputFiles.length===0&&!(request.inputArtifacts?.length),'PUBLIC_TEXT_ONLY',400);
  const callback=new URL(request.callbackUrl);
  requireThat(callback.origin===this.config.callbackOrigin&&callback.pathname===`/v1/agent-runs/${request.taskRunId}/events`&&callback.searchParams.has('token')&&!callback.username&&!callback.password,'CALLBACK_URL_REJECTED',400);
  const answers=request.requirement.startupAnswers??[];
  requireThat(new Set(answers.map(x=>x.requirementId)).size===answers.length,'INVALID_STARTUP_ANSWERS');
  const general=answers.some(x=>x.requirementId==='task-request');
  const answerText=answers.find(x=>x.requirementId===(general?'task-request':'public-text'))?.value;
  const text=general ? [request.requirement.goal,answerText,...request.requirement.outputs].filter(Boolean).join('\n') : answerText;
  if(!general)requireThat(answers.find(x=>x.requirementId==='public-declaration')?.value==='我确认这段文本可公开且不包含私人信息','PUBLIC_DECLARATION_REQUIRED');
  const input=inputContract({schemaVersion:general?'public_task.v1':'public_text_summary.v1',input:{text,declaredPublic:true}});
  const digest=sha256Canonical({taskRunId:request.taskRunId,agentVersionId:request.agentVersionId,deliveryRevision:request.deliveryRevision,taskContext:c,input,callbackHash:sha256Canonical(request.callbackUrl)});
  const t=await this.service.create({userId:c.userId,grantId:'standard-agent-run',taskIds:[]},`platform-run:${request.taskRunId}`,input,this.service.config.publicExecution?this.config.owner:undefined);
  const current=await this.service.transaction(s=>{
   const task=s.tasks[t.taskId];
   requireThat(!task.platformRun||task.platformRun.digest===digest,'RUN_ID_REUSED',409);
   if(!task.platformRun) task.platformRun={id:request.taskRunId,digest,callback:encryptSecret(request.callbackUrl,this.config.encryptionKey),createdAt:this.service.now(),delivered:false,next:0,attempts:0};
   return {status:task.status,version:task.version};
  });
  // The signed standard task includes user confirmation plus the platform admission snapshot.
  if(current.status==='INPUT_REVIEW') {
   try { await this.service.review(t.taskId,{expectedVersion:current.version,decision:'approve'},'platform:confirmed-standard-task'); }
   catch(error) { if (!(error instanceof Error) || !['STATE_CONFLICT','VERSION_CONFLICT'].includes(error.message)) throw error; }
  }
  return {accepted:true,remoteRunId:t.taskId};
 }
 private artifactToken(id:string) { return createHmac('sha256',this.config.secret).update(`approved-summary:${id}`).digest('hex'); }
 async artifact(id:string,token:string) {
  uuid(id);const expected=Buffer.from(this.artifactToken(id)),actual=Buffer.from(token);
  requireThat(expected.length===actual.length&&timingSafeEqual(expected,actual),'AUTH_REQUIRED',401);
  const text=await this.service.transaction(s=>{
   const t=s.tasks[id];requireThat(t?.status==='COMPLETED'&&t.platformRun,'NOT_FOUND',404);
   this.service.allowed(t.executorOwner??t.owner);
   const c=t.candidates.find((c:any)=>c.id===t.approvedCandidateId&&c.review==='APPROVED');requireThat(c,'NOT_FOUND',404);
   if(t.executorOwner&&t.input.schemaVersion==='public_text_summary.v1')requireSourceOnlyResult(t.input.input.text,c.result);
   return c.result.points.map((p:string,i:number)=>`${i+1}. ${p}`).join('\n')+'\n';
  });
  return Buffer.from(text);
 }
 async tick() {
  const pending=await this.service.transaction(s=>Object.values(s.tasks).filter(t=>t.executorOwner&&t.platformRun&&t.status==='RESULT_REVIEW').slice(0,10).map(t=>({id:t.id,version:t.version,candidateId:t.candidates.at(-1)?.id})));
  for(const p of pending) {
   try {await this.service.review(p.id,{expectedVersion:p.version,decision:'approve',candidateId:p.candidateId},'platform:source-only-result-review');}catch{/* Revoked or stale candidates cannot be delivered. */}
  }
  const jobs=await this.service.transaction(s=>Object.values(s.tasks).filter(t=>t.platformRun&&!t.platformRun.delivered&&t.platformRun.next<=this.service.now()&&terminal.includes(t.status)).slice(0,10).map(t=>{
   const r=t.platformRun;r.next=this.service.now()+Math.min(300000,5000*2**Math.min(r.attempts++,6));
   return {id:t.id,run:structuredClone(r),status:t.status};
  }));
  for(const j of jobs) {
   try {
    const event:AgentRunEventV1={eventId:`${j.run.id}:terminal`,taskRunId:j.run.id,sequence:1,type:j.status==='COMPLETED'?'RUN_SUCCEEDED':'RUN_FAILED',occurredAt:new Date(j.run.createdAt).toISOString()};
    if(j.status==='COMPLETED') {
     const bytes=await this.artifact(j.id,this.artifactToken(j.id));
     event.artifacts=[{artifactId:'public-summary',fileName:'任务结果.txt',mimeType:'text/plain',sizeBytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),downloadUrl:`${this.config.endpointBase}/artifacts/${j.id}?token=${this.artifactToken(j.id)}`}];
    } else event.errorCode='PUBLIC_SUMMARY_EXECUTION_FAILED';
    const response=await this.send(decryptSecret(j.run.callback,this.config.encryptionKey),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(event),redirect:'error',signal:AbortSignal.timeout(15000)});
    if(response.ok) await this.service.transaction(s=>{const r=s.tasks[j.id]?.platformRun;if(r?.digest===j.run.digest)r.delivered=true;});
   } catch { /* Durable outbox retries preserve the event id. No secrets are logged. */ }
  }
 }
}
