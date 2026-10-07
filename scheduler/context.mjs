import {createHash} from 'node:crypto';
import {assert} from '../protocol/validation.mjs';
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const contextOf=t=>t?.context;
const valid=c=>c&&typeof c.contextKey==='string'&&/^[a-f0-9]{64}$/.test(c.contextKey);
// Invoked inside the scheduler transaction; identities come from authenticated principals.
export function routeContext({state,caller,agentId,taskId,mode,previousTaskId}) {
 const owned=t=>t?.caller===caller&&t.agentId===agentId&&valid(contextOf(t));
 if(previousTaskId)assert(mode==='CALLER_AGENT'&&owned(state.tasks[previousTaskId]),'CONTEXT_NOT_OWNED',404);
 if(mode==='NONE'||!mode)return undefined;
 if(mode==='TASK')return {contextKey:digest(['task-context-v1',agentId,caller,taskId]),mode:'NEW',taskId};
 assert(mode==='CALLER_AGENT','INVALID_CONTEXT_MODE');
 state.contextBindings??={};
 const slot=digest([agentId,caller]);let binding=state.contextBindings[slot];
 if(binding)assert(binding.caller===caller&&binding.agentId===agentId&&valid(binding),'CONTEXT_NOT_OWNED',404);
 const legacy=Object.values(state.tasks).filter(owned).sort((a,b)=>b.createdAt-a.createdAt||a.id.localeCompare(b.id))[0];
 const continuing=Boolean(binding||legacy);
 if(!binding){binding={caller,agentId,contextKey:contextOf(legacy)?.contextKey??digest(['user-context-v1',agentId,caller])};state.contextBindings[slot]=binding}
 return {contextKey:binding.contextKey,mode:continuing?'CONTINUE':'NEW',taskId};
}
