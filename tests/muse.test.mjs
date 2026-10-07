import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {Engine,hash} from '../scheduler/engine.mjs';
import {createScheduler} from '../scheduler/server.mjs';
import {Client} from '../sdk/client.mjs';
const cap=JSON.parse(await readFile(new URL('../protocol/public-summary.json',import.meta.url),'utf8'));
function python(v){return new Promise((resolve,reject)=>{const child=spawn('python3',['-B','adapters/muse/client.py'],{stdio:['pipe','pipe','pipe']});let out='',err='';child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>err+=x);child.on('error',reject);child.on('close',code=>{try{resolve({code,value:JSON.parse(out),err})}catch(e){reject(e)}});child.stdin.end(JSON.stringify(v))})}
test('Muse public signal, agent routing, Python lease and result transport',async()=>{
 const tokens=Object.fromEntries(['owner','caller','executor'].map(r=>[r,randomBytes(32).toString('hex')]));
 const engine=await new Engine().open(),channel='synthetic-public-channel';
 const config={credentials:Object.entries(tokens).map(([role,token])=>({role,subject:role==='executor'?'muse-one':role,tokenHash:hash(token)})),publicSignals:[{channel,agentId:'muse-one'}]};
 const server=createScheduler(engine,config);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const url='http://127.0.0.1:'+server.address().port,owner=new Client({url,token:tokens.owner}),caller=new Client({url,token:tokens.caller});
  const signal=async()=>{const r=await fetch(url+'/v1/signals/'+channel);assert.equal(r.headers.get('cache-control'),'no-store');return r.json()};
  await owner.register({id:'muse-one',name:'Muse test',capabilities:[cap]});await owner.register({id:'other',name:'Other',capabilities:[cap]});
  assert.deepEqual(await signal(),{available:false});
  await caller.submit({agentId:'other',capabilityId:cap.id,capabilityVersion:cap.version,input:{text:'Other queue'}},'other');
  assert.deepEqual(await signal(),{available:false});
  const task=await caller.submit({agentId:'muse-one',capabilityId:cap.id,capabilityVersion:cap.version,input:{text:'Synthetic public input'}},'muse');
  assert.deepEqual(await signal(),{available:true});
  await owner.control('muse-one','pause');assert.deepEqual(await signal(),{available:false});await owner.control('muse-one','resume');
  const call=v=>python({url,token:tokens.executor,...v});
  const claim=await call({action:'claim',claimRequestId:'claim-one'});assert.equal(claim.code,0);const a=claim.value.assignment;assert.equal(a.taskId,task.id);
  assert.deepEqual(await signal(),{available:false});assert.equal((await call({action:'heartbeat',assignment:a})).code,0);
  const completion={action:'result',assignment:a,submissionId:'receipt-one',result:{points:['Synthetic result']}};
  assert.equal((await call(completion)).code,0);assert.equal((await call(completion)).code,0);
  assert.equal((await caller.get(task.id)).status,'SUCCEEDED');
  await owner.control('muse-one','revoke');assert.deepEqual(await signal(),{available:false});assert.equal((await call({action:'claim',claimRequestId:'after-revoke'})).value.status,403);
  assert.equal((await fetch(url+'/v1/signals/unknown-public-channel')).status,404);
 }finally{await new Promise(r=>server.close(r))}
});
test('signal is opt-in and Python rejects remote HTTP without exposing credentials',async()=>{
 const engine=await new Engine().open(),server=createScheduler(engine,{credentials:[{role:'owner',subject:'owner',tokenHash:hash('x'.repeat(32))}]});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));try{assert.equal((await fetch('http://127.0.0.1:'+server.address().port+'/v1/signals/synthetic-public-channel')).status,404)}finally{await new Promise(r=>server.close(r))}
 const result=await python({url:'http://example.com',token:'secret'.repeat(8),action:'claim',claimRequestId:'test'});assert.equal(result.code,1);assert.deepEqual(result.value,{error:'REQUEST_FAILED'});assert.equal(result.err,'');
});

test('hook emits one wake or silent and fails closed on network/malformed signals',async()=>{
 const {mkdtemp,writeFile,chmod,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const dir=await mkdtemp(join(tmpdir(),'muse-hook-'));
 try{
  await writeFile(join(dir,'runtime.sh'),'wake(){ printf "wake\\n"; }\nsilent(){ printf "silent\\n"; }\n');
  await writeFile(join(dir,'curl'),'#!/bin/sh\nif [ "$PROBE_FAIL" = 1 ]; then exit 1; fi\nprintf "%s" "$PROBE_BODY"\n');await chmod(join(dir,'curl'),0o700);
  const run=body=>new Promise((resolve,reject)=>{const child=spawn('bash',['adapters/muse/probe.sh'],{env:{...process.env,PATH:dir+':'+process.env.PATH,HATCH_HOOK_RUNTIME:join(dir,'runtime.sh'),AD_SIGNAL_URL:'https://synthetic.invalid/v1/signals/synthetic-channel',PROBE_BODY:body,PROBE_FAIL:body==='fail'?'1':'0'}});let out='';child.stdout.on('data',x=>out+=x);child.on('error',reject);child.on('close',code=>resolve({out,code}))});
  assert.deepEqual(await run('{"available":true}'),{out:'wake\n',code:0});
  for(const body of ['{"available":false}','fail','not json','{"available":true,"task":"private"}'])assert.deepEqual(await run(body),{out:'silent\n',code:0});
 }finally{await rm(dir,{recursive:true,force:true})}
});
