# Optional mini-program transport

CommonJS helper for WeChat `wx.request`; no complete mini-program or login backend is bundled.

```js
const {createMiniappClient} = require('./index');
const client = createMiniappClient({
  wx,
  baseUrl: 'https://YOUR_SCHEDULER_DOMAIN',
  getCallerToken: async () => await yourAuthenticatedSession.getScopedCallerToken()
});
const task = await client.submit(taskContract, persistedRequestId);
```

Configure the platform's allowed request domain yourself. The host application must authenticate each user and provide a separate caller subject/credential or a trusted backend proxy. Never include owner/executor/shared caller credentials in app source. The reference scheduler does not issue short-lived app credentials; that integration must be implemented before public mini-program use.

The plugin exposes `agents`, `submit`, `get` and `cancel`. It intentionally contains no Agent IDs, product IDs, prices, payment logic, UI, proprietary domain or special reception agent. It is optional: direct Node.js callers work without it.
