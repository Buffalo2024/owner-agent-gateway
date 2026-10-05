import {randomUUID} from 'node:crypto';
export class Client {
 constructor({url,token,allowInsecureRemote=false}){const u=new URL(url);if(u.protocol!=='https:'&&!(u.protocol==='http:'&&(allowInsecureRemote||['127.0.0.1','localhost','[::1]'].includes(u.hostname))))throw Error('HTTPS_REQUIRED');this.url=url.replace(/\/$/,'');this.token=token}
 async request(path,method='GET',data,key){
  const response=await fetch(this.url+path,{method,redirect:'error',headers:{authorization:'Bearer '+this.token,...(data===undefined?{}:{'content-type':'application/json'}),...(key?{'idempotency-key':key}:{})},body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(15000)});
  const value=await response.json();if(!response.ok){const e=Error(value.error||'REQUEST_FAILED');e.code=value.error;e.status=response.status;throw e}return value;
 }
 agents(){return this.request('/v1/agents')}
 register(v){return this.request('/v1/agents','POST',v)}
 control(id,action){return this.request('/v1/agents/'+encodeURIComponent(id)+'/control','POST',{action})}
 submit(v,key=randomUUID()){return this.request('/v1/tasks','POST',v,key)}
 get(id){return this.request('/v1/tasks/'+encodeURIComponent(id))}
 cancel(id){return this.request('/v1/tasks/'+encodeURIComponent(id),'DELETE')}
 async claim(key){return (await this.request('/v1/executor/claim','POST',{claimRequestId:key})).assignment}
 heartbeat(a){return this.request('/v1/executor/tasks/'+encodeURIComponent(a.taskId)+'/heartbeat','POST',{attempt:a.attempt,leaseId:a.leaseId})}
 finish(a,submissionId,result,error){return this.request('/v1/executor/tasks/'+encodeURIComponent(a.taskId)+'/result','POST',{attempt:a.attempt,leaseId:a.leaseId,submissionId,...(error?{error}:{result})})}
 audit(){return this.request('/v1/audit')}
}
