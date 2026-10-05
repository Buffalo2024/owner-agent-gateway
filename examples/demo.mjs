import {randomBytes} from 'node:crypto';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Engine,hash} from '../scheduler/engine.mjs';
import {createScheduler} from '../scheduler/server.mjs';
import {Client} from '../sdk/client.mjs';
import {Worker} from '../gateway/worker.mjs';
import {mockAdapter} from '../adapters/mock/index.mjs';
const dir=await mkdtemp(join(tmpdir(),'agent-dispatch-demo-'));
const tokens=Object.fromEntries(['owner','caller','executor'].map(r=>[r,randomBytes(32).toString('hex')]));
const config={credentials:Object.entries(tokens).map(([role,token])=>({role,subject:role==='executor'?'demo-agent':'demo-'+role,tokenHash:hash(token)}))};
const engine=await new Engine({file:join(dir,'state.json')}).open(),server=createScheduler(engine,config);
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
try{
 const url='http://127.0.0.1:'+server.address().port,owner=new Client({url,token:tokens.owner}),caller=new Client({url,token:tokens.caller}),executor=new Client({url,token:tokens.executor});
 const capability=JSON.parse(await readFile(new URL('../protocol/public-summary.json',import.meta.url),'utf8'));
 await owner.register({id:'demo-agent',name:'Local demonstration executor',capabilities:[capability]});
 const task=await caller.submit({agentId:'demo-agent',capabilityId:capability.id,capabilityVersion:capability.version,input:{text:'A personal agent keeps owner control. A gateway accepts scoped tasks. Results return asynchronously.'}},'demo-task');
 await new Worker({client:executor,adapter:mockAdapter}).cycle();
 const result=await caller.get(task.id);if(result.status!=='SUCCEEDED')throw Error('DEMO_FAILED');
 console.log(JSON.stringify({demo:true,adapter:'deterministic mock; no real agent or model called',status:result.status,result:result.result},null,2));
 await owner.control('demo-agent','pause');await owner.control('demo-agent','resume');await owner.control('demo-agent','revoke');
 console.log('Owner pause, resume and permanent revocation verified. Temporary state cleaned.');
}finally{await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true})}
