# Contributing

## Development

Node.js 24+. No runtime dependencies.

```sh
npm ci
npm run check
npm test
npm run demo
```

Keep protocol changes versioned and update examples/docs/tests together. Use synthetic task inputs. Do not add production accounts, private memory, deployment IPs, OAuth codes or secrets. A new adapter must document supported host APIs, wake behavior, isolation and cancellation limitations.

## Pull requests

Explain the concrete behavior, compatibility impact and verification. Tests should cover meaningful failure modes rather than only mirror implementation. Do not claim host support based on a mock. New mandatory dependencies on a named agent, marketplace, UI or payment provider do not belong in the core; add optional plugins.

Contributions are submitted under the repository MIT license. State the origin/license of external code or assets. No CLA is currently required. The original author's private assistant and production services are outside this repository.

## Project conventions

- Dependency-free modern JavaScript modules for core; CommonJS only for the optional mini-program helper.
- Fixed error codes and metadata-only logs.
- Server authority for task ownership, lease and frozen capability.
- No task-controlled command paths or implicit host credentials.
- README in English and Chinese; technical docs currently in English.
- Before 1.0, breaking protocol changes need a migration note and an explicit version change.
