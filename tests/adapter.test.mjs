import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {commandAdapter} from '../adapters/command/index.mjs';
const assignment={taskId:'example',capability:{id:'public-summary'},input:{text:'$(touch /tmp/agent-dispatch-should-never-exist); arbitrary task text'}};
test('fixed executable receives JSON data without shell evaluation',async()=>{const result=await commandAdapter({command:process.execPath,args:[fileURLToPath(new URL('../examples/command-wrapper.mjs',import.meta.url))]}).execute(assignment,{signal:new AbortController().signal});assert.equal(result.points[0],assignment.input.text)});
test('adapter rejects relative commands and kills timed-out work',async()=>{assert.throws(()=>commandAdapter({command:'node'}),/FIXED_ABSOLUTE_COMMAND_REQUIRED/);await assert.rejects(commandAdapter({command:process.execPath,args:['-e','setInterval(()=>{},1000)']}).execute(assignment,{signal:AbortSignal.timeout(100)}),/TIMEOUT/)});
test('child process does not inherit parent secrets',async()=>{process.env.AD_TEST_SECRET='must-not-pass';try{const result=await commandAdapter({command:process.execPath,args:['-e','process.stdin.resume();process.stdin.on("end",()=>process.stdout.write(JSON.stringify({secret:process.env.AD_TEST_SECRET??null})))']}).execute(assignment,{signal:AbortSignal.timeout(3000)});assert.equal(result.secret,null)}finally{delete process.env.AD_TEST_SECRET}});
test('unbounded adapter output is rejected',async()=>{await assert.rejects(commandAdapter({command:process.execPath,args:['-e','process.stdout.write("x".repeat(4096))'],maxOutputBytes:100}).execute(assignment,{signal:AbortSignal.timeout(3000)}),/EXECUTION_ERROR/)});
