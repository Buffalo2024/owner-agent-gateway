// Optional generic reception hook. No model or endpoint is required.
export function receptionPlugin({buildTask,confirm}){
 if(typeof buildTask!=='function'||typeof confirm!=='function')throw Error('RECEPTION_CALLBACKS_REQUIRED');
 return {async submit({client,message,idempotencyKey}){
  const task=await buildTask(message);if(!await confirm(task))return {status:'NEEDS_CONFIRMATION',task};
  return client.submit(task,idempotencyKey);
 }};
}
