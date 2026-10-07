// Synthetic text artifact demo. No host, private files or model is invoked.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Engine,hash} from '../scheduler/engine.mjs';
import {ResultFiles} from '../scheduler/result-files.mjs';
import {createScheduler} from '../scheduler/server.mjs';
import {Client} from '../sdk/client.mjs';
const dir=await mkdtemp(join(tmpdir(),'owner-agent-files-'));
let server;
try {
 const tokens=Object.fromEntries(['owner','caller','executor'].map(r=>[r,randomBytes(32).toString('hex')]));
 const engine=await new Engine({resultFiles:new ResultFiles(join(dir,'files'))}).open();
 server=createScheduler(engine,{credentials:Object.entries(tokens).map(([role,t])=>({role,subject:role==='executor'?'demo-agent':role,tokenHash:hash(t)}))});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
 const url='http://127.0.0.1:'+server.address().port;
 const clients=Object.fromEntries(Object.entries(tokens).map(([r,token])=>[r,new Client({url,token})]));
 const cap=JSON.parse(await readFile(new URL('../protocol/public-task.json',import.meta.url),'utf8'));
 await clients.owner.register({id:'demo-agent',name:'Synthetic executor',capabilities:[cap],contextMode:'CALLER_AGENT'});
 const t=await clients.caller.submit({agentId:'demo-agent',capabilityId:cap.id,capabilityVersion:cap.version,input:{text:'Create a synthetic text artifact',expectedOutputs:[]}},'demo-files');
 const a=await clients.executor.claim('demo-claim');
 const bytes=Buffer.from('Synthetic task output. No private data.\n');
 const artifact=await clients.executor.uploadFile(a,bytes,{fileName:'result.txt',mimeType:'text/plain'});
 await clients.executor.finish(a,'demo-result',{taskId:a.taskId,inputHash:a.inputHash,text:'Synthetic delivery',files:[artifact.artifactId]});
 assert.deepEqual(Buffer.from(await clients.caller.downloadFile(t.id,artifact.artifactId)),bytes);
 assert.equal((await clients.caller.get(t.id)).status,'SUCCEEDED');
 console.log('PASS: claim → task-bound upload → result → authenticated download (synthetic, no host call)');
} finally {
 if(server)await new Promise(resolve=>server.close(resolve));
 await rm(dir,{recursive:true,force:true});
}
