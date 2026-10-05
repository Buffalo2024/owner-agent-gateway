import {readdir,readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
const files=[];
async function walk(dir){for(const item of await readdir(dir,{withFileTypes:true})){if(['.git','.runtime','node_modules'].includes(item.name))continue;const path=join(dir,item.name);if(item.isDirectory())await walk(path);else files.push(path)}}
await walk('.');let bad=false;
for(const file of files){if(/\.(mjs|js)$/.test(file)){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status){bad=true;console.error(file+' syntax failed')}}
 if(/\.(mjs|js|ts|json|md|yml|yaml|example)$/.test(file)){const text=await readFile(file,'utf8');if(/-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/.test(text)||/\b(?:sk-[A-Za-z0-9]{24,}|ghp_[A-Za-z0-9]{30,})\b/.test(text)){bad=true;console.error(file+' credential pattern found')}}
}
if(bad)process.exit(1);console.log('Syntax and basic credential-pattern checks passed (not a full security audit).');
