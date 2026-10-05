import test from 'node:test';import assert from 'node:assert/strict';
import {receptionPlugin} from '../plugins/reception/index.mjs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{createMiniappClient}=require('../plugins/miniapp/index.js');
test('optional reception plugin never submits unconfirmed requests',async()=>{let sent=0;const p=receptionPlugin({buildTask:async()=>({agentId:'demo-agent'}),confirm:async()=>false});const v=await p.submit({client:{submit:async()=>sent++},message:'test',idempotencyKey:'key'});assert.equal(v.status,'NEEDS_CONFIRMATION');assert.equal(sent,0)});
test('miniapp plugin uses host-issued caller credential, preserves idempotency',async()=>{let captured;const c=createMiniappClient({wx:{request:r=>{captured=r;r.success({statusCode:201,data:{id:'task'}})}},baseUrl:'https://example.invalid',getCallerToken:async()=>'per-user-token'});assert.equal((await c.submit({input:{text:'public'}},'request-key')).id,'task');assert.equal(captured.header.authorization,'Bearer per-user-token');assert.equal(captured.header['idempotency-key'],'request-key');assert.throws(()=>c.submit({},''),/IDEMPOTENCY_KEY_REQUIRED/)});
