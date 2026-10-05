import {createServer} from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {hash} from './engine.mjs';
import {assert,Fault,only} from '../protocol/validation.mjs';
export function credentials(config){
 assert(Array.isArray(config.credentials)&&config.credentials.length>0,'CREDENTIALS_REQUIRED');
 const hashes=new Set();
 return config.credentials.map(c=>{only(c,['role','subject','tokenHash']);assert(['owner','caller','executor'].includes(c.role)&&typeof c.subject==='string'&&c.subject.length>0&&/^[a-f0-9]{64}$/.test(c.tokenHash),'INVALID_CREDENTIAL');assert(!hashes.has(c.tokenHash),'DUPLICATE_CREDENTIAL');hashes.add(c.tokenHash);return c});
}
async function body(req){let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;assert(size<=131072,'BODY_TOO_LARGE',413);chunks.push(chunk)}try{return JSON.parse(Buffer.concat(chunks).toString()||'{}')}catch{throw new Fault('INVALID_JSON')}}
export function createScheduler(engine,config){
 const creds=credentials(config);
 return createServer(async(req,res)=>{
  const send=(status,data)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(data))};
  try{
   const u=new URL(req.url,'http://localhost'),p=u.pathname;
   if(p==='/health'&&req.method==='GET')return send(200,{status:'ok',protocol:'agent-dispatch/0.1'});
   const header=String(req.headers.authorization||'');assert(/^Bearer [^\s]+$/i.test(header),'AUTH_REQUIRED',401);const token=header.slice(7);assert(token.length>=32&&token.length<=1024,'AUTH_REQUIRED',401);const h=Buffer.from(hash(token),'hex');const principal=creds.find(c=>timingSafeEqual(h,Buffer.from(c.tokenHash,'hex')));assert(principal,'AUTH_REQUIRED',401);
   const role=r=>assert(principal.role===r,'FORBIDDEN',403);
   if(p==='/v1/agents'&&req.method==='GET')return send(200,{items:await engine.agents()});
   if(p==='/v1/agents'&&req.method==='POST'){role('owner');return send(201,await engine.register(principal.subject,await body(req)))}
   const control=p.match(/^\/v1\/agents\/([A-Za-z0-9_.-]+)\/control$/);
   if(control&&req.method==='POST'){role('owner');const v=await body(req);only(v,['action']);return send(200,await engine.control(principal.subject,control[1],v.action))}
   if(p==='/v1/tasks'&&req.method==='POST'){role('caller');return send(201,await engine.submit(principal.subject,String(req.headers['idempotency-key']||''),await body(req)))}
   const task=p.match(/^\/v1\/tasks\/([a-f0-9-]{36})$/);
   if(task&&req.method==='GET'){role('caller');return send(200,await engine.get(principal.subject,task[1]))}
   if(task&&req.method==='DELETE'){role('caller');return send(200,await engine.cancel(principal.subject,task[1]))}
   if(p==='/v1/executor/claim'&&req.method==='POST'){role('executor');const v=await body(req);only(v,['claimRequestId']);return send(200,{assignment:await engine.claim(principal.subject,v.claimRequestId)})}
   const execution=p.match(/^\/v1\/executor\/tasks\/([a-f0-9-]{36})\/(heartbeat|result)$/);
   if(execution&&req.method==='POST'){role('executor');return send(200,await engine[execution[2]==='heartbeat'?'heartbeat':'finish'](principal.subject,execution[1],await body(req)))}
   if(p==='/v1/audit'&&req.method==='GET'){role('owner');return send(200,{items:await engine.audit(principal.subject)})}
   throw new Fault('NOT_FOUND',404);
  }catch(e){send(e instanceof Fault?e.status:500,{error:e instanceof Fault?e.code:'INTERNAL_ERROR'})}
 });
}
