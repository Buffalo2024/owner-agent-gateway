import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Engine} from '../scheduler/engine.mjs';
const cap=JSON.parse(await readFile(new URL('../protocol/public-summary.json',import.meta.url),'utf8'));
const agent=(id,mode)=>({id,name:id,capabilities:[cap],...(mode?{contextMode:mode}:{})});
const input=(id='one')=>({agentId:id,capabilityId:cap.id,capabilityVersion:cap.version,input:{text:'Public synthetic text'}});
test('context is opt-in; task mode freezes a fresh context through retries',async()=>{
 let now=1;const e=new Engine({clock:()=>now,leaseMs:10});await e.register('owner',agent('one'));
 const t=await e.submit('alice','none',input());let a=await e.claim('one','claim');assert.equal(a.context,undefined);await e.finish('one',t.id,{attempt:a.attempt,leaseId:a.leaseId,submissionId:'result',result:{points:['done']}});
 await e.register('owner',agent('one','TASK'));const t2=await e.submit('alice','new',input());a=await e.claim('one','claim2');now=12;const retry=await e.claim('one','retry');assert.deepEqual(retry.context,a.context);assert.equal(retry.context.taskId,t2.id);
 const t3=await e.submit('alice','other',input());assert.notEqual(e.state.tasks[t3.id].context.contextKey,a.context.contextKey);
});
test('caller/agent bindings survive restart and task idempotency never changes context',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ad-context-'));try{
  const file=join(dir,'state.json');let e=await new Engine({file}).open();await e.register('owner',agent('one','CALLER_AGENT'));await e.register('owner',agent('two','CALLER_AGENT'));
  const first=await e.submit('alice','first',input());const ctx=e.state.tasks[first.id].context;assert.equal(ctx.mode,'NEW');
  e=await new Engine({file}).open();const second=await e.submit('alice','second',input());assert.equal(e.state.tasks[second.id].context.contextKey,ctx.contextKey);assert.equal(e.state.tasks[second.id].context.mode,'CONTINUE');
  const replay=await e.submit('alice','first',input());assert.equal(replay.id,first.id);assert.deepEqual(e.state.tasks[first.id].context,ctx);
  for(const [caller,id] of [['bob','one'],['alice','two']]){const other=await e.submit(caller,'other',input(id));assert.notEqual(e.state.tasks[other.id].context.contextKey,ctx.contextKey)}
  await e.register('owner',agent('one'));assert.equal(e.state.agents.one.contextMode,'CALLER_AGENT');
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('previous task references cannot cross caller/agent or fabricate a context',async()=>{
 const e=new Engine();await e.register('owner',agent('one','CALLER_AGENT'));await e.register('owner',agent('two','CALLER_AGENT'));const t=await e.submit('alice','first',input());
 for(const [caller,id] of [['bob','one'],['alice','two']])await assert.rejects(e.submit(caller,'wrong',{...input(id),previousTaskId:t.id}),/CONTEXT_NOT_OWNED/);
 await assert.rejects(e.submit('alice','unknown',{...input(),previousTaskId:'unknown'}),/CONTEXT_NOT_OWNED/);
 const next=await e.submit('alice','next',{...input(),previousTaskId:t.id});assert.equal(e.state.tasks[next.id].context.contextKey,e.state.tasks[t.id].context.contextKey);
 // Caller input is never adopted as a server-owned legacy routing binding.
 e.state.tasks.fake={id:'fake',agentId:'one',caller:'mallory',createdAt:99,input:{context:{contextKey:e.state.tasks[t.id].context.contextKey}}};
 const own=await e.submit('mallory','own',input());assert.notEqual(e.state.tasks[own.id].context.contextKey,e.state.tasks[t.id].context.contextKey);
});
