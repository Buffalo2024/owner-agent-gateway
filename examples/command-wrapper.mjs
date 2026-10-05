// Replace this deterministic example with a supported invocation of your agent.
let raw='';for await(const chunk of process.stdin){raw+=chunk;if(raw.length>131072)throw Error('INPUT_TOO_LARGE')}
const task=JSON.parse(raw);if(task.capability.id!=='public-summary')throw Error('UNSUPPORTED_CAPABILITY');
process.stdout.write(JSON.stringify({points:[Array.from(task.input.text).slice(0,200).join('')]}));
