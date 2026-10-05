import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,isAbsolute} from 'node:path';
// Owner-selected executable only. Task data is stdin JSON, never shell text.
// A separate process is NOT a filesystem or network security sandbox.
export function commandAdapter({command,args=[],env={},maxOutputBytes=131072}){
 if(!isAbsolute(command)||!Array.isArray(args)||args.some(x=>typeof x!=='string'))throw Error('FIXED_ABSOLUTE_COMMAND_REQUIRED');
 return {id:'command',isolation:'separate process; host permissions remain; owner must supply sandbox',async execute(assignment,{signal}){
  signal.throwIfAborted();const cwd=await mkdtemp(join(tmpdir(),'agent-dispatch-'));
  try{return await new Promise((resolve,reject)=>{
   const child=spawn(command,args,{cwd,env:{PATH:'/usr/bin:/bin',...env},shell:false,detached:process.platform!=='win32',stdio:['pipe','pipe','pipe']});
   let size=0,done=false;const chunks=[];
   const kill=()=>{try{if(process.platform!=='win32'&&child.pid)process.kill(-child.pid,'SIGKILL');else child.kill('SIGKILL')}catch{}};
   const abort=()=>{kill();finish(Error('TIMEOUT'))};
   const finish=(error,result)=>{if(done)return;done=true;signal.removeEventListener('abort',abort);error?reject(error):resolve(result)};
   signal.addEventListener('abort',abort,{once:true});if(signal.aborted)return abort();
   child.on('error',()=>finish(Error('ADAPTER_UNAVAILABLE')));child.stdin.on('error',()=>{});
   child.stdout.on('data',chunk=>{size+=chunk.length;if(size>maxOutputBytes){kill();finish(Error('EXECUTION_ERROR'))}else chunks.push(chunk)});
   // Never forward stderr: it may contain credentials or private context.
   child.stderr.resume();
   child.on('close',code=>{if(done)return;if(code!==0)return finish(Error('EXECUTION_ERROR'));try{finish(null,JSON.parse(Buffer.concat(chunks).toString('utf8')))}catch{finish(Error('EXECUTION_ERROR'))}});
   child.stdin.end(JSON.stringify({protocol:'agent-dispatch/0.1',taskId:assignment.taskId,capability:assignment.capability,input:assignment.input}));
  })}finally{await rm(cwd,{recursive:true,force:true})}
 }};
}
