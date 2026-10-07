import {createHash,randomUUID} from 'node:crypto';
import {Fault} from '../protocol/validation.mjs';
import {mkdir,writeFile,rename,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
export const MAX_FILE_BYTES=10*1024*1024;
export const MIME_TYPES=['text/plain','text/markdown','text/csv','application/json','application/pdf','image/png','image/jpeg','image/gif','image/webp','audio/mpeg','audio/wav','audio/mp4','video/mp4','video/webm','application/msword','application/vnd.ms-excel','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/zip','application/gzip','application/octet-stream'];
const fail=c=>{throw new Fault(c)};
export function checkBytes(b,mime){
 if(!Buffer.isBuffer(b)||!b.length||b.length>MAX_FILE_BYTES)fail('RESULT_FILE_SIZE_INVALID');
 if(!MIME_TYPES.includes(mime))fail('RESULT_FILE_TYPE_UNSUPPORTED');
 const head=(n)=>b.subarray(0,n).toString();
 if(mime==='video/mp4'||mime==='audio/mp4'){if(b.length<12||b.subarray(4,8).toString()!=='ftyp')fail('RESULT_FILE_MIME_MISMATCH')}
 if(mime==='video/webm'&&b.subarray(0,4).toString('hex')!=='1a45dfa3')fail('RESULT_FILE_MIME_MISMATCH');
 if(mime==='image/png'&&b.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')fail('RESULT_FILE_MIME_MISMATCH');
 if(mime==='image/jpeg'&&b.subarray(0,3).toString('hex')!=='ffd8ff')fail('RESULT_FILE_MIME_MISMATCH');
 if(mime==='image/gif'&&!['GIF87a','GIF89a'].includes(head(6)))fail('RESULT_FILE_MIME_MISMATCH');
 if(mime==='image/webp'&&(head(4)!=='RIFF'||b.subarray(8,12).toString()!=='WEBP'))fail('RESULT_FILE_MIME_MISMATCH');
 if(mime==='audio/wav'&&(head(4)!=='RIFF'||b.subarray(8,12).toString()!=='WAVE'))fail('RESULT_FILE_MIME_MISMATCH');
 if(mime==='audio/mpeg'&&!(head(3)==='ID3'||b[0]===255&&(b[1]&224)===224))fail('RESULT_FILE_MIME_MISMATCH');
 if(mime==='application/pdf'&&head(5)!=='%PDF-')fail('RESULT_FILE_MIME_MISMATCH');
 if((mime.includes('openxmlformats')||mime==='application/zip')&&head(2)!=='PK')fail('RESULT_FILE_MIME_MISMATCH');
 if(mime==='application/gzip'&&b.subarray(0,2).toString('hex')!=='1f8b')fail('RESULT_FILE_MIME_MISMATCH');
 if(mime.startsWith('text/')||mime==='application/json'){try{new TextDecoder('utf-8',{fatal:true}).decode(b)}catch{fail('RESULT_FILE_ENCODING_INVALID')}}
 if(mime==='application/json')try{JSON.parse(b.toString())}catch{fail('RESULT_FILE_JSON_INVALID')}
}
export function requiredKinds(outputs=[]){
 const s=outputs.join('\n');const kinds=[];
 if(/视频|video|\.mp4\b|\.webm\b/i.test(s)&&!/(视频脚本|视频文案|video script)/i.test(s))kinds.push('video/');
 if(/音频|音效|配音文件|audio|\.mp3\b|\.wav\b/i.test(s))kinds.push('audio/');
 if(/图片|头像|海报|image|\.png\b|\.jpg\b/i.test(s))kinds.push('image/');
 for(const [re,m] of [[/PDF文件|PDF报告|\.pdf\b/i,'application/pdf'],[/Word文档|DOCX|\.docx\b/i,'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],[/Excel|XLSX|\.xlsx\b/i,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],[/PPTX|PowerPoint|\.pptx\b/i,'application/vnd.openxmlformats-officedocument.presentationml.presentation']])if(re.test(s))kinds.push(m);
 return kinds;
}
export function assertDelivery(outputs,files,text){
 if(!files.length&&!text?.trim())fail('RESULT_EMPTY');
 for(const kind of requiredKinds(outputs))if(!files.some(f=>f.mimeType.startsWith(kind)))fail('RESULT_REQUIRED_FILE_MISSING');
}
export class ResultFiles {
 constructor(root){this.root=resolve(root)}
 location(scope,id){if(!/^[a-f0-9-]{36}$/.test(scope)||!/^[a-f0-9]{64}$/.test(id))fail('RESULT_FILE_ID_INVALID');return join(this.root,scope,id)}
 async put(scope,data,metadata){
 const {fileName,mimeType}=metadata;
 if(typeof fileName!=='string'||!fileName.length||fileName.length>180||/[\x00-\x1f/\\]/u.test(fileName))fail('RESULT_FILE_NAME_INVALID');
 checkBytes(data,mimeType);const sha256=createHash('sha256').update(data).digest('hex');
 const artifactId=createHash('sha256').update(JSON.stringify([fileName,mimeType,sha256])).digest('hex');const path=this.location(scope,artifactId);await mkdir(join(this.root,scope),{recursive:true,mode:0o700});
 const descriptor={artifactId,fileName,mimeType,sizeBytes:data.length,sha256};const tmp=path+'.'+randomUUID();await writeFile(tmp,data,{mode:0o600});await rename(tmp,path);const mt=tmp+'.json';await writeFile(mt,JSON.stringify(descriptor),{mode:0o600});await rename(mt,path+'.json');return descriptor;
 }
 async get(scope,id){const path=this.location(scope,id);const descriptor=JSON.parse(await readFile(path+'.json','utf8'));const data=await readFile(path);checkBytes(data,descriptor.mimeType);if(descriptor.artifactId!==id||descriptor.sizeBytes!==data.length||createHash('sha256').update(data).digest('hex')!==descriptor.sha256)fail('RESULT_FILE_CORRUPT');return {descriptor,data}}
 async descriptors(scope,ids){if(!Array.isArray(ids)||ids.length>8||new Set(ids).size!==ids.length)fail('RESULT_FILES_INVALID');return Promise.all(ids.map(async id=>(await this.get(scope,id)).descriptor))}
}
