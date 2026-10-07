import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtemp,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {Engine,hash} from '../scheduler/engine.mjs';
import {ResultFiles,MAX_FILE_BYTES} from '../scheduler/result-files.mjs';
import {createScheduler} from '../scheduler/server.mjs';
import {Client} from '../sdk/client.mjs';
const cap=JSON.parse(await readFile(new URL('../protocol/public-task.json',import.meta.url),'utf8'));
const python=v=>new Promise((resolve,reject)=>{const child=spawn('python3',['-B','adapters/muse/client.py']);let out='',err='';child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>err+=x);child.on('error',reject);child.on('close',code=>{try{resolve({code,value:JSON.parse(out),err})}catch(e){reject(e)}});child.stdin.end(JSON.stringify(v))});
const submit={agentId:'muse-one',capabilityId:cap.id,capabilityVersion:cap.version,input:{text:'Synthetic video',expectedOutputs:['MP4 video']}};
const proof=a=>({attempt:a.attempt,leaseId:a.leaseId});
test('Python binary upload and result transport, owner-only downloads, required formats and cross-task binding',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ad-files-'));let server;try{
  const fileStore=new ResultFiles(join(dir,'files'));const e=new Engine({leaseMs:120000,resultFiles:fileStore});const tok=Object.fromEntries(['owner','caller','executor','other'].map(x=>[x,randomBytes(32).toString('hex')]));
  server=createScheduler(e,{credentials:Object.entries(tok).map(([r,t])=>({role:r==='other'?'caller':r,subject:r==='executor'?'muse-one':r,tokenHash:hash(t)}))});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const url='http://127.0.0.1:'+server.address().port;const owner=new Client({url,token:tok.owner}),caller=new Client({url,token:tok.caller}),other=new Client({url,token:tok.other}),executor=new Client({url,token:tok.executor});
  await owner.register({id:'muse-one',name:'Synthetic Muse',capabilities:[cap],contextMode:'CALLER_AGENT'});const t=await caller.submit(submit,'one');const call=v=>python({url,token:tok.executor,...v});const a=(await call({action:'claim',claimRequestId:'first'})).value.assignment;
  const text=await executor.uploadFile(a,Buffer.from('This is not a video'),{fileName:'notes.txt',mimeType:'text/plain'});
  await assert.rejects(executor.finish(a,'missing',{text:'done',files:[text.artifactId]}),/RESULT_REQUIRED_FILE_MISSING/);
  const bytes=Buffer.concat([Buffer.from([0,0,0,24]),Buffer.from('ftypisom'),Buffer.from('synthetic-container-header-only')]);const path=join(dir,'video.mp4');await writeFile(path,bytes);
  const upload=await call({action:'upload-file',assignment:a,filePath:path,fileName:'视频.mp4',mimeType:'video/mp4'});assert.equal(upload.code,0);assert.equal(upload.err,'');const f=upload.value;assert.equal(f.sizeBytes,bytes.length);
  const completion={action:'result',assignment:a,submissionId:'success',result:{text:'Synthetic transport fixture, not playable media',files:[f.artifactId]}};
  assert.equal((await call(completion)).code,0);assert.equal((await call(completion)).code,0);assert.equal((await caller.get(t.id)).status,'SUCCEEDED');
  assert.deepEqual(Buffer.from(await caller.downloadFile(t.id,f.artifactId)),bytes);await assert.rejects(other.downloadFile(t.id,f.artifactId),e=>e.status===404);
  const next=await caller.submit(submit,'two');const b=await executor.claim('second');assert.equal(b.context.mode,'CONTINUE');assert.equal(b.context.contextKey,a.context.contextKey);assert.notEqual(b.taskId,a.taskId);
  await assert.rejects(executor.finish(b,'foreign-file',{text:'wrong',files:[f.artifactId]}),/RESULT_FILE_NOT_UPLOADED/);
  await assert.rejects(executor.uploadFile(a,bytes,{fileName:'old.mp4',mimeType:'video/mp4'}),/STALE_LEASE/);
  await caller.cancel(next.id);assert.equal((await call({action:'upload-file',assignment:b,filePath:path,mimeType:'video/mp4'})).value.status,409);
  await owner.control('muse-one','revoke');assert.equal((await call({action:'upload-file',assignment:b,filePath:path,mimeType:'video/mp4'})).value.status,403);
 }finally{if(server)await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true})}
});
test('file storage rejects spoofed/oversized bytes, traversal, extra uploads and corrupted files',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ad-file-limits-'));try{
  const files=new ResultFiles(dir);let now=1;const e=new Engine({resultFiles:files,clock:()=>now,leaseMs:10});await e.register('owner',{id:'one',name:'one',capabilities:[cap]});const t=await e.submit('caller','one',{...submit,agentId:'one',input:{text:'Public',expectedOutputs:[]}});const a=await e.claim('one','claim');
  const upload=(data,name='notes.txt',mime='text/plain')=>e.upload('one',t.id,proof(a),data,{fileName:name,mimeType:mime});
  await assert.rejects(upload(Buffer.from('fake'),'fake.mp4','video/mp4'),/MIME_MISMATCH/);await assert.rejects(upload(Buffer.alloc(MAX_FILE_BYTES+1)),/SIZE_INVALID/);await assert.rejects(upload(Buffer.from('x'),'../private'),/NAME_INVALID/);await assert.rejects(upload(Buffer.alloc(0)),/SIZE_INVALID/);
  const ids=[];for(let i=0;i<8;i++)ids.push((await upload(Buffer.from('text'+i),'notes'+i+'.txt')).artifactId);
  assert.equal((await upload(Buffer.from('text0'),'notes0.txt')).artifactId,ids[0]);await assert.rejects(upload(Buffer.from('ninth'),'ninth.txt'),/RESULT_FILES_LIMIT/);assert.equal((await readdir(join(dir,t.id))).length,16);
  await assert.rejects(e.finish('one',t.id,{...proof(a),submissionId:'wrong',result:{taskId:t.id,inputHash:'0'.repeat(64),text:'wrong',files:[ids[0]]}}),/RESULT_TASK_BINDING_MISMATCH/);
  await writeFile(join(dir,t.id,ids[0]),'modified');await assert.rejects(e.finish('one',t.id,{...proof(a),submissionId:'corrupt',result:{taskId:t.id,inputHash:a.inputHash,text:'result',files:[ids[0]]}}),/RESULT_FILE_CORRUPT/);
  now=12;await e.claim('one','retry');await assert.rejects(upload(Buffer.from('text0'),'notes0.txt'),/STALE_LEASE/);
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('file transport remains disabled without an owner-selected store',async()=>{
 const e=new Engine();await e.register('owner',{id:'one',name:'one',capabilities:[cap]});const t=await e.submit('caller','one',{...submit,agentId:'one'});const a=await e.claim('one','claim');await assert.rejects(e.upload('one',t.id,proof(a),Buffer.from('x'),{fileName:'x.txt',mimeType:'text/plain'}),/RESULT_FILES_DISABLED/);
});
