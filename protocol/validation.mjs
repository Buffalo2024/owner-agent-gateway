export class Fault extends Error {
  constructor(code,status=400){super(code);this.code=code;this.status=status}
}
export function assert(condition,code,status=400){if(!condition)throw new Fault(code,status)}
export function only(value,keys){assert(value&&typeof value==='object'&&!Array.isArray(value),'INVALID_OBJECT');assert(Object.keys(value).every(k=>keys.includes(k)),'UNKNOWN_FIELD')}
export function identifier(value){assert(typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(value),'INVALID_ID');return value}
const supported=['type','properties','required','additionalProperties','items','minLength','maxLength','minimum','maximum','minItems','maxItems','enum'];
export function validateSchema(s,depth=0){
 assert(depth<=12&&s&&typeof s==='object'&&!Array.isArray(s),'INVALID_SCHEMA');only(s,supported);
 assert(['object','string','integer','number','boolean','array'].includes(s.type),'UNSUPPORTED_SCHEMA');
 if(s.enum)assert(Array.isArray(s.enum)&&s.enum.length>0&&s.enum.length<=100,'INVALID_SCHEMA');
 for(const k of ['minLength','maxLength','minItems','maxItems'])if(s[k]!==undefined)assert(Number.isInteger(s[k])&&s[k]>=0&&s[k]<=65536,'INVALID_SCHEMA');
 for(const k of ['minimum','maximum'])if(s[k]!==undefined)assert(Number.isFinite(s[k]),'INVALID_SCHEMA');
 for(const [a,b] of [['minLength','maxLength'],['minItems','maxItems'],['minimum','maximum']])if(s[a]!==undefined&&s[b]!==undefined)assert(s[a]<=s[b],'INVALID_SCHEMA');
 if(s.type==='object'){
  assert(s.additionalProperties===false&&s.properties&&typeof s.properties==='object'&&!Array.isArray(s.properties),'CLOSED_SCHEMA_REQUIRED');
  assert(Object.keys(s.properties).length<=100,'INVALID_SCHEMA');
  assert(s.required===undefined||(Array.isArray(s.required)&&s.required.every(k=>typeof k==='string'&&Object.hasOwn(s.properties,k))),'INVALID_SCHEMA');
  for(const v of Object.values(s.properties))validateSchema(v,depth+1);
 }
 if(s.type==='array'){assert(s.maxItems!==undefined,'BOUNDED_ARRAY_REQUIRED');validateSchema(s.items,depth+1)}
 if(s.type==='string')assert(s.maxLength!==undefined,'BOUNDED_STRING_REQUIRED');
}
// Intentionally bounded JSON Schema subset; unsupported keywords fail closed.
export function validate(s,v){
 if(s.type==='object'){
  assert(v&&typeof v==='object'&&!Array.isArray(v),'SCHEMA_MISMATCH');
  assert(Object.keys(v).every(k=>Object.hasOwn(s.properties,k)),'SCHEMA_MISMATCH');
  assert((s.required||[]).every(k=>Object.hasOwn(v,k)),'SCHEMA_MISMATCH');
  for(const [k,x] of Object.entries(v))validate(s.properties[k],x);
 }else if(s.type==='array'){
  assert(Array.isArray(v)&&v.length>=(s.minItems??0)&&v.length<=s.maxItems,'SCHEMA_MISMATCH');for(const x of v)validate(s.items,x);
 }else if(s.type==='string'){
  assert(typeof v==='string'&&Array.from(v).length>=(s.minLength??0)&&Array.from(v).length<=s.maxLength,'SCHEMA_MISMATCH');
 }else if(s.type==='boolean')assert(typeof v==='boolean','SCHEMA_MISMATCH');
 else assert(typeof v==='number'&&Number.isFinite(v)&&(s.type!=='integer'||Number.isSafeInteger(v))&&v>=(s.minimum??-Infinity)&&v<=(s.maximum??Infinity),'SCHEMA_MISMATCH');
 if(s.enum)assert(s.enum.some(x=>JSON.stringify(x)===JSON.stringify(v)),'SCHEMA_MISMATCH');
}
export function capability(v){
 only(v,['id','version','title','inputSchema','outputSchema','permissions','execution']);identifier(v.id);identifier(v.version);
 assert(typeof v.title==='string'&&v.title.length>0&&v.title.length<=200,'INVALID_TITLE');
 validateSchema(v.inputSchema);validateSchema(v.outputSchema);
 only(v.permissions,['data','tools']);assert(v.permissions.data==='task-only'&&Array.isArray(v.permissions.tools)&&v.permissions.tools.every(x=>typeof x==='string'&&x.length<=100),'INVALID_PERMISSIONS');
 only(v.execution,['maxConcurrency','timeoutSeconds','maxAttempts']);
 assert(Number.isInteger(v.execution.maxConcurrency)&&v.execution.maxConcurrency>=1&&v.execution.maxConcurrency<=16,'INVALID_CONCURRENCY');
 assert(Number.isInteger(v.execution.timeoutSeconds)&&v.execution.timeoutSeconds>=1&&v.execution.timeoutSeconds<=3600,'INVALID_TIMEOUT');
 assert(Number.isInteger(v.execution.maxAttempts)&&v.execution.maxAttempts>=1&&v.execution.maxAttempts<=5,'INVALID_ATTEMPTS');return v;
}
