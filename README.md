# Agent Dispatch

Turn an existing personal AI assistant into an owner-controlled, schedulable task executor.

[简体中文](README.zh-CN.md) · [Quick start](docs/quickstart.md) · [Protocol](docs/protocol.md) · [Architecture](docs/architecture.md) · [Security](SECURITY.md)

**A standalone project maintained in its own repository, without a required platform or model.**

> **Context warning:** dots plugin calls do not display context in the frontend, but underlying context still exists. This integration does not establish verifiable tenant isolation or independent contexts. Separate task records are not separate assistant memories. Do not accept mutually untrusted users or sensitive tasks.

Agent Dispatch supplies a small task protocol, an outbound gateway, host adapters and a self-hostable reference scheduler. The assistant stays in its owner's environment. External callers receive access to explicitly declared capabilities; they do not receive ownership of the assistant or its private context.

**Status: experimental v0.1.0 reference implementation.** The runnable demo uses a deterministic adapter, not a real model. Command execution is implemented; no commercial assistant host is certified. This repository does not include the private assistant, production accounts, credentials or deployment data from the original proof of concept.

## Positioning and verified scope

A personal AI assistant capability-sharing protocol and reference implementation for accepting external tasks. Intended for personal developers, controlled small trials and single-tenant services; not marketed as a production commercial scheduling platform.

### Original dots deployment — historical live evidence

These live results were verified and confirmed by the project maintainer, not reproduced by this repository's CI against real payments or dots.

- Verified: real assistant authorization, claim/read/submit, task lifecycle and standard handshake.
- Verified: computer-hosted bridge and actual event-driven asynchronous execution.
- Verified: the complete live WeChat mini-program flow from real payment through recording, including requirement confirmation, execution, artifact delivery, user acceptance and historian records.

**The mini-program integration used the owner's computer and its local network proxy. It was not a direct server-to-GPT execution relay.** The computer must remain running and connected. See the [deployment explanation](docs/dots-computer-bridge.zh-CN.md) and [redacted real source](examples/dots-adapter/README.md).

### This repository

- Tested: generic scheduler/gateway, mock/command execution and task protocol.
- Not provided: multi-tenant private-context/tool isolation.
- Not production storage: generic scheduler uses single-process JSON. The original PostgreSQL bridge store was also not a scale-certified queue.
- Not certified: a standalone generic dots host adapter. Its directory contains historical redacted implementation sources with retained original-platform dependencies.

Join the proposed [multi-tenant isolation discussion](docs/discussions/multi-tenant-isolation.md).

## Intended users and host responsibility

Use this reference to connect your own assistant to controlled tasks or study the protocol and computer bridge. The current dots integration is limited to personal use or a single trust domain whose participants accept the lack of independent context/tool isolation. It is not suitable for a public service promising tenant-separated private data.

Caller authentication, task ownership and result validation do not isolate dots memory. Hidden frontend history, separate task IDs, restrictive prompts and separate gateway processes are not substitutes for host isolation. A supported solution requires dots to expose and guarantee independent sessions, memory partitions and tool-permission boundaries, followed by adapter-side verification. This repository does not promise to fix host-internal isolation externally. See [isolation](docs/isolation.md).

## Run it

Requirements: Node.js 24 or newer. No runtime dependencies or model API key.

```sh
npm ci
npm run demo
npm test
npm run check
```

The demo starts a real loopback HTTP scheduler, registers a capability, submits a task, executes it through the gateway and retrieves a result. It also verifies owner pause/resume/revoke. Credentials and state are generated in a temporary directory and removed at the end. It does not configure a real assistant or contact a cloud model.

See [manual setup](docs/quickstart.md) to keep the scheduler running and connect your own wrapper.

## What is included

- Versioned capability contracts with bounded input/output schemas.
- Owner, caller and executor credentials with separate roles and subjects.
- Task leases, heartbeats, deadlines, bounded retry after lease loss and idempotent receipts.
- Caller ownership checks and server-frozen capability versions.
- Outbound polling gateway; no public address required on a personal computer.
- Owner pause/resume and permanent agent revocation.
- Fixed-command adapter: JSON over stdin/stdout, no task-controlled shell command.
- Deterministic mock adapter and integration/fault tests.
- Optional reception hook and WeChat mini-program transport plugin.

## What is not included

- A filesystem/network sandbox, automatic access to private memory, or permission isolation inside arbitrary assistant hosts.
- Certified ChatGPT, Codex, OpenClaw or other vendor-specific wake adapters.
- A marketplace, payments, distributed scheduler, automatic OAuth enrollment or credential refresh.
- Full JSON Schema: the supported bounded subset is described in the protocol.
- A production security audit or measured multi-user load capacity.

## Structure

```text
protocol/     Contracts and bounded schema validator
scheduler/    Single-process reference HTTP scheduler and persistent state
sdk/          Dependency-free Node.js client
gateway/     Outbound worker and owner-local run controls
adapters/     Mock and fixed-command adapters
plugins/      Optional reception and mini-program integration
examples/     Synthetic, reproducible examples
tests/       Conformance, transport, adapter and plugin tests
docs/        Deployment, isolation, host integration and release guides
```

The optional `plugins/reception` hook accepts injected callbacks and requires no named agent, model or service. The mini-program plugin is a transport helper, not a complete application or login backend. Both can be omitted without changing the core. No original-platform account, authorization or private code is needed to run the root demo. Only the optional historical dots snapshot retains original-platform imports.

## Host integration

Provide an adapter with `execute(assignment, { signal }) -> result`, or supply an owner-selected executable that reads one JSON envelope from stdin and writes one JSON result to stdout. The adapter must use a supported host invocation and document its wake, session isolation, tools and cancellation behavior.

Start with [the adapter guide](docs/adapters.md). A command process can still access everything allowed to its OS account; use a dedicated account/container or a host sandbox before accepting untrusted tasks.

## Contributing and publication

See [CONTRIBUTING](CONTRIBUTING.md), [the roadmap](ROADMAP.md) and [the publication checklist](docs/publishing.md). GitHub workflows use repository-local tests. The standalone repository is [Buffalo2024/agent-dispatch](https://github.com/Buffalo2024/agent-dispatch); see [repository metadata](docs/github-metadata.md). No npm package is published; the isolation discussion remains a local draft.

```sh
git clone https://github.com/Buffalo2024/agent-dispatch.git
cd agent-dispatch
```

Core, generic plugins and the maintainer-authorized dots snapshot are MIT licensed. See [license review](docs/license-review.md) for attribution and scope. [Security reports](SECURITY.md). [Code of conduct](CODE_OF_CONDUCT.md).

## Contact and marketplace demo

Technical discussion and business collaboration: `zzjeff1993.agent@gmail.com`. Mention Agent Dispatch when adding the author on WeChat.

| 共生纪市场 / Marketplace mini-program | Author WeChat |
| --- | --- |
| <img src="assets/contact/market-miniapp-code.jpg" width="200" alt="共生纪市场 mini-program code"> | <img src="assets/contact/wechat-qr.jpg" width="200" alt="Author WeChat QR code"> |

The marketplace is an optional experience/contact link, not a runtime dependency or evidence of multi-tenant context isolation.
