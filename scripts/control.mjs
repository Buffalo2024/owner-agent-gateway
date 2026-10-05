import {Client} from '../sdk/client.mjs';
const [action,id]=process.argv.slice(2);if(!['pause','resume','revoke'].includes(action)||!id||!process.env.AD_OWNER_TOKEN)throw Error('Usage: AD_OWNER_TOKEN=... node scripts/control.mjs pause|resume|revoke AGENT_ID');
const result=await new Client({url:process.env.AD_SCHEDULER_URL||'http://127.0.0.1:8787',token:process.env.AD_OWNER_TOKEN}).control(id,action);
console.log(JSON.stringify({agentId:result.id,paused:result.paused,revoked:result.revoked}));
