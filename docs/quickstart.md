# Quick start

## Requirements

Node.js 24+, npm, local filesystem access. Linux/macOS are the tested target of the command adapter's process-group cancellation. Windows uses direct child termination; descendant cleanup is not certified. The mock demo does not need a model account.

```sh
npm ci
npm run demo
```

## Persistent manual setup

Run these commands from the repository root:

```sh
node scripts/configure.mjs .runtime
npm run start:scheduler
```

The configuration generator writes three random credentials to ignored `.runtime/credentials.json` and only their hashes to `.runtime/config.json`. Files have restricted permissions. It refuses to overwrite an existing configuration. Keep these files private.

In another terminal, register a sample capability and submit a task:

```sh
node --input-type=module <<'JS'
import {readFile} from 'node:fs/promises';
import {Client} from './sdk/client.mjs';
const tokens=JSON.parse(await readFile('.runtime/credentials.json','utf8'));
const url='http://127.0.0.1:8787';
const owner=new Client({url,token:tokens.owner});
const cap=JSON.parse(await readFile('protocol/public-summary.json','utf8'));
await owner.register({id:'demo-agent',name:'My demonstration executor',capabilities:[cap]});
const caller=new Client({url,token:tokens.caller});
const task=await caller.submit({agentId:'demo-agent',capabilityId:cap.id,capabilityVersion:cap.version,input:{text:'Use only supplied material. The owner controls access.'}},'first-task');
console.log('Task ID:',task.id);
JS
```

Start a demonstration gateway:

```sh
AD_EXECUTOR_TOKEN="$(node -p "JSON.parse(require('fs').readFileSync('.runtime/credentials.json')).executor")" \
AD_ADAPTER=mock npm run start:gateway
```

Read the result, replacing `TASK_ID` with the returned ID:

```sh
TASK_ID=REPLACE_WITH_RETURNED_TASK_ID node --input-type=module <<'JS'
import {readFile} from 'node:fs/promises';
import {Client} from './sdk/client.mjs';
const tokens=JSON.parse(await readFile('.runtime/credentials.json','utf8'));
console.log(await new Client({url:'http://127.0.0.1:8787',token:tokens.caller}).get(process.env.TASK_ID));
JS
```

## Connect a command wrapper

Stop the mock gateway first. Determine the absolute Node executable and wrapper paths:

```sh
AD_EXECUTOR_TOKEN="$(node -p "JSON.parse(require('fs').readFileSync('.runtime/credentials.json')).executor")" \
AD_ADAPTER=command \
AD_COMMAND="$(node -p process.execPath)" \
AD_COMMAND_ARGS="$(node -p "JSON.stringify([require('path').resolve('examples/command-wrapper.mjs')])")" \
npm run start:gateway
```

This wrapper is also deterministic. Replace it with your own supported host invocation following [adapters.md](adapters.md). Do not treat a successful wrapper test as evidence of private-data isolation.

## Owner controls

For each command, load the owner credential privately:

```sh
AD_OWNER_TOKEN="$(node -p "JSON.parse(require('fs').readFileSync('.runtime/credentials.json')).owner")" \
node scripts/control.mjs pause demo-agent
```

Change `pause` to `resume` for temporary re-enable, or `revoke` for permanent agent revocation. Revocation cancels pending/running tasks and blocks that agent ID from resuming. Reconnect using a new agent ID and a new executor credential after explicit owner authorization. The reference credential list is loaded on scheduler startup; replacing credentials requires a restart.

On Unix, `kill -USR1 GATEWAY_PID` pauses local polling after its current task, `kill -USR2 GATEWAY_PID` resumes and Ctrl-C stops the gateway. These local process controls do not revoke server authorization.
