import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {validate} from '../protocol/validation.mjs';
export class Worker {
 constructor({client,adapter,pollMs=1000,onEvent=()=>{}}){this.client=client;this.adapter=adapter;this.pollMs=pollMs;this.onEvent=onEvent;this.paused=false;this.stopped=false;this.active=null;this.claimKey=randomUUID()}
 pause(){this.paused=true}
 resume(){this.paused=false}
 stop(){this.stopped=true;this.active?.abort()}
 async cycle(){
  if(this.paused||this.stopped)return false;
  let a;try{a=await this.client.claim(this.claimKey);this.claimKey=randomUUID()}catch(e){if(e.status===401||e.status===403){this.stop();this.onEvent('authorization-rejected')}else this.onEvent('connection-unavailable');return false}
  if(!a)return false;
  const controller=new AbortController();this.active=controller;const timeout=Math.max(1,a.attemptDeadline-Date.now());
  const timer=setTimeout(()=>controller.abort(),timeout);let lost=false,beating=false;
  const beat=async()=>{if(beating||controller.signal.aborted)return;beating=true;try{await this.client.heartbeat(a)}catch{lost=true;controller.abort();this.onEvent('lease-lost')}finally{beating=false}};
  const interval=setInterval(beat,Math.max(100,Math.min(3000,Math.floor((a.leaseExpiresAt-Date.now())/3))));
  let result,error;
  try{await this.client.heartbeat(a);validate(a.capability.inputSchema,a.input);result=await this.adapter.execute(a,{signal:controller.signal});validate(a.capability.outputSchema,result)}catch(e){error=controller.signal.aborted?'TIMEOUT':['ADAPTER_UNAVAILABLE','INPUT_UNUSABLE'].includes(e.message)?e.message:'EXECUTION_ERROR'}
  finally{clearTimeout(timer);clearInterval(interval);this.active=null}
  if(lost||this.stopped)return false;
  const submissionId=randomUUID();
  for(let i=0;i<3;i++)try{await this.client.finish(a,submissionId,result,error);this.onEvent(error?'task-failed':'task-completed');return true}catch(e){if(e.status&&e.status<500){this.onEvent('result-rejected');return false}await delay(100*(i+1))}
  this.onEvent('result-unconfirmed');return false;
 }
 async run(){while(!this.stopped){await this.cycle();if(!this.stopped)await delay(this.pollMs)}}
}
