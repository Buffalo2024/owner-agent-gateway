import {Client} from '../sdk/client.mjs';
import {Worker} from './worker.mjs';
import {mockAdapter} from '../adapters/mock/index.mjs';
import {commandAdapter} from '../adapters/command/index.mjs';
if(!process.env.AD_EXECUTOR_TOKEN)throw Error('AD_EXECUTOR_TOKEN_REQUIRED');
const kind=process.env.AD_ADAPTER||'command';if(!['command','mock'].includes(kind))throw Error('UNKNOWN_ADAPTER');
const adapter=kind==='mock'?mockAdapter:commandAdapter({command:process.env.AD_COMMAND||'',args:JSON.parse(process.env.AD_COMMAND_ARGS||'[]')});
const worker=new Worker({client:new Client({url:process.env.AD_SCHEDULER_URL||'http://127.0.0.1:8787',token:process.env.AD_EXECUTOR_TOKEN}),adapter,onEvent:kind=>console.log(kind)});
process.on('SIGINT',()=>worker.stop());process.on('SIGTERM',()=>worker.stop());
// Unix owner-local controls: pause new work, resume; current task continues.
if(process.platform!=='win32'){process.on('SIGUSR1',()=>worker.pause());process.on('SIGUSR2',()=>worker.resume())}
console.log('Gateway started; logs exclude task input, output and credentials.');await worker.run();
