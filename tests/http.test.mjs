import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {Engine,hash} from '../scheduler/engine.mjs';
import {createScheduler} from '../scheduler/server.mjs';
import {Client} from '../sdk/client.mjs';
import {Worker} from '../gateway/worker.mjs';
import {mockAdapter} from '../adapters/mock/index.mjs';
const cap=JSON.parse(await readFile(new URL('../protocol/public-summary.json',import.meta.url),'utf8'));
test('real HTTP registration, execution, role rejection and revocation',async()=>{
 const tokens=Object.fromEntries(['owner','caller','executor'].map(r=>[r,randomBytes(32).toString('hex')]));
 const engine=await new Engine().open(),server=createScheduler(engine,{credentials:Object.entries(tokens).map(([role,token])=>({role,subject:role==='executor'?'agent-one':role,tokenHash:hash(token)}))});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
 try{const url='http://127.0.0.1:'+server.address().port,owner=new Client({url,token:tokens.owner}),caller=new Client({url,token:tokens.caller}),executor=new Client({url,token:tokens.executor});
  assert.equal((await fetch(url+'/v1/agents')).status,401);
  assert.equal((await fetch(url+'/v1/agents',{headers:{authorization:tokens.owner}})).status,401);
  await owner.register({id:'agent-one',name:'Public executor',capabilities:[cap]});
  await assert.rejects(caller.control('agent-one','revoke'),/FORBIDDEN/);
  const t=await caller.submit({agentId:'agent-one',capabilityId:cap.id,capabilityVersion:cap.version,input:{text:'Only public material. Owner remains in control.'}},'task');
  assert.equal(await new Worker({client:executor,adapter:mockAdapter}).cycle(),true);
  assert.equal((await caller.get(t.id)).status,'SUCCEEDED');
  assert.equal((await owner.agents()).items[0].online,true);
  await owner.control('agent-one','revoke');await assert.rejects(executor.claim('again'),/EXECUTOR_REVOKED/);
  const worker=new Worker({client:executor,adapter:mockAdapter});await worker.cycle();assert.equal(worker.stopped,true);
 }finally{await new Promise(resolve=>server.close(resolve))}
});
test('SDK rejects remote plain HTTP',()=>{assert.throws(()=>new Client({url:'http://example.com',token:'test'}),/HTTPS_REQUIRED/)});
