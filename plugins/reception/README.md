# Optional reception plugin

A generic, optional pre-submission hook for clarifying a request and confirming the resulting task. No specific assistant, original-platform account, subscription or proprietary service is required. Omit it when your caller already supplies confirmed tasks.

```js
import {receptionPlugin} from './index.mjs';
const reception = receptionPlugin({
  buildTask: async message => ({
    agentId: 'demo-agent', capabilityId: 'public-summary',
    capabilityVersion: '1.0.0', input: {text: message}
  }),
  confirm: async task => true // Replace with explicit user confirmation.
});
await reception.submit({client: callerClient, message: 'Public text.', idempotencyKey: requestId});
```

Use your own model or deterministic logic for `buildTask`. The callback can clarify or reject a request. With `confirm:false`, no scheduler submission occurs. This plugin does not replace scheduler schema/permission checks, perform content moderation or automatically charge a user.
