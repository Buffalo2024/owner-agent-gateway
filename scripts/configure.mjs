import {randomBytes} from 'node:crypto';
import {mkdir,writeFile,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {hash} from '../scheduler/engine.mjs';
const dir=resolve(process.argv[2]||'.runtime');await mkdir(dir,{recursive:true,mode:0o700});
try{await access(dir+'/config.json');throw Error('CONFIG_ALREADY_EXISTS')}catch(e){if(e.code!=='ENOENT')throw e}
const tokens=Object.fromEntries(['owner','caller','executor'].map(role=>[role,randomBytes(32).toString('hex')]));
const credentials=Object.entries(tokens).map(([role,token])=>({role,subject:role==='executor'?'demo-agent':role==='owner'?'demo-owner':'demo-caller',tokenHash:hash(token)}));
await writeFile(dir+'/config.json',JSON.stringify({credentials},null,2)+'\n',{mode:0o600,flag:'wx'});
await writeFile(dir+'/credentials.json',JSON.stringify(tokens,null,2)+'\n',{mode:0o600,flag:'wx'});
console.log('Created credential files with restricted permissions in '+dir+'; no tokens printed.');
