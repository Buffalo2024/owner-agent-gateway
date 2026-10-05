export const mockAdapter={
 id:'mock-excerpts',isolation:'task-input-only; deterministic demonstration; not an LLM',
 async execute(assignment,{signal}){
  signal.throwIfAborted();if(assignment.capability.id!=='public-summary')throw Error('ADAPTER_UNAVAILABLE');
  const source=assignment.input.text;const pieces=source.split(/(?<=[.!?。！？])\s*/u).filter(x=>x.trim()).slice(0,3);
  return {points:pieces.map(x=>Array.from(x.trim()).slice(0,200).join(''))};
 }
};
