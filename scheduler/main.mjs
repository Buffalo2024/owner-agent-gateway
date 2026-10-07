import {readFile} from 'node:fs/promises';
import {ResultFiles} from './result-files.mjs';
import {Engine} from './engine.mjs';
import {createScheduler} from './server.mjs';
const config=JSON.parse(await readFile(process.env.AD_CONFIG||'.runtime/config.json','utf8'));
const engine=await new Engine({file:process.env.AD_STATE||'.runtime/state.json',resultFiles:process.env.AD_FILES?new ResultFiles(process.env.AD_FILES):null}).open();
const host=process.env.AD_HOST||'127.0.0.1',port=Number(process.env.AD_PORT||8787);
const server=createScheduler(engine,config);server.requestTimeout=15000;server.headersTimeout=10000;
await new Promise(resolve=>server.listen(port,host,resolve));
console.log(`Agent Dispatch scheduler listening on ${host}:${port}`);
let ticking=false;const timer=setInterval(async()=>{if(ticking)return;ticking=true;try{await engine.tx(()=>{engine.sweep();return null})}catch{console.error('STATE_WRITE_FAILED')}finally{ticking=false}},1000);
async function stop(){clearInterval(timer);server.close();await engine.serial;process.exit(0)}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
