import {createHash} from 'node:crypto';
import {readdir,readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
const files=[];
async function walk(dir){for(const item of await readdir(dir,{withFileTypes:true})){if(['.git','.runtime','node_modules'].includes(item.name))continue;const path=join(dir,item.name);if(item.isDirectory())await walk(path);else files.push(path)}}
await walk('.');let bad=false;
for(const file of files){if(/\.(mjs|js)$/.test(file)){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status){bad=true;console.error(file+' syntax failed')}}
 if(file.endsWith('.py')){const r=spawnSync('python3',['-B','-c','import ast,sys; ast.parse(open(sys.argv[1], encoding="utf-8").read())',file],{encoding:'utf8'});if(r.status!==0){bad=true;console.error(file+' Python syntax check failed')}}
 if(file.endsWith('.sh')){const r=spawnSync('bash',['-n',file],{encoding:'utf8'});if(r.status!==0){bad=true;console.error(file+' shell syntax check failed')}}
 if(/\.(mjs|js|ts|mts|py|sh|json|md|yml|yaml|example)$/.test(file)){const text=await readFile(file,'utf8');if(/-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/.test(text)||/\b(?:sk-[A-Za-z0-9]{24,}|gh[pousr]_[A-Za-z0-9]{30,})\b/.test(text)){bad=true;console.error(file+' credential pattern found')}}
}
const manifest=JSON.parse(await readFile('examples/dots-adapter/source-manifest.json','utf8'));for(const entry of manifest.files){const bytes=await readFile(join('examples/dots-adapter',entry.file));if(createHash('sha256').update(bytes).digest('hex')!==entry.sha256){bad=true;console.error(entry.file+' snapshot hash mismatch')}}
if(bad)process.exit(1);console.log('Syntax and basic credential-pattern checks passed (not a full security audit).');
