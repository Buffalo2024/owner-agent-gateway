# dots adapter — real implementation reference

[中文部署说明](../../docs/dots-computer-bridge.zh-CN.md)

This directory contains redacted source from a bridge used with a real personal dots assistant. It is versioned implementation evidence, not a new standalone host adapter certified against the generic Agent Dispatch scheduler.

Original-platform interfaces remain only as historical source references; public names have been generalized. They are not prerequisites for the runnable root project. The snapshot needs the interfaces listed below to be ported; no account signup can make those omitted interfaces available in this repository.

## License and provenance review

See the file-by-file [review record](../../docs/license-review.md) and [NOTICE](NOTICE). The refreshed eleven-file manifest was inspected for imports and attribution notices; all hashes match. On 2026-10-05 the maintainer confirmed that these are owned sources with redistribution rights and authorized MIT publication under the root LICENSE. This is a maintainer declaration, not an independent legal audit. No dots endorsement, vendor source-code license or license for omitted private platform modules is implied.

## What actually ran

A public HTTPS ingress forwarded bridge traffic through an SSH reverse tunnel to a process on the owner's computer. That process used the computer's configured local HTTP CONNECT proxy to reach the assistant host. OAuth/MCP tools, task leases, event notifications and result callbacks connected the existing assistant to the platform. The computer had to remain awake, running and connected. The mainland server did not directly execute or relay the full assistant-host communication.

Real controlled tests confirmed OAuth connection, manual claim/read/submit, actual event-driven assistant execution, candidate review and standard Agent handshake. The original platform included mini-program integration; the complete live mini-program flow from real payment through execution, delivery, user acceptance and historian recording was verified from platform records.

## Source map

| File | Role |
|---|---|
| contracts.ts | Bounded inputs/results, MCP tools, legacy source-only checks and task-bound file results |
| service.ts | OAuth, task ownership, claims, retries, receipts and revocation |
| store.ts | Original PostgreSQL-backed bridge state |
| rpc.ts | MCP/JSON-RPC tools and host event interface |
| events.ts | Subscription verification, encrypted secrets and event delivery |
| local-proxy.ts | Explicit loopback CONNECT proxy and TLS verification |
| platform-agent.ts | Original platform handshake and result callback adapter |
| capability-card.ts | Original restricted capability description |
| http.ts | HTTP/OAuth/MCP routes and composition, binary upload/download |
| agent-results/files.mjs / files.d.mts | Shared bounded artifact storage, format checks and delivery requirements |

`source-manifest.json` hashes the published redacted files. It contains no task IDs, account IDs, host dot IDs or credential values.

## 2026-10-06 snapshot update

Release 0.4.1 now includes `prepare_result_upload`, lease-bound upload URLs, `public_task.result.v2`, binary artifact callbacks and the shared `reference-source/agent-results/files.mjs` implementation with its type declaration. Per-file SHA256 values are refreshed. Owner labels and the sample price constant are generalized; wire protocol names remain for compatibility. The snapshot still retains original-platform imports and is not independently runnable.

## Dependencies and portability

These TypeScript files retain imports into the original platform: native-access, protocol-adapters, agent-runtime and platform contracts. They also use `pg` and the host-specific event/OAuth behavior. Those dependencies are not silently replaced by mocks. Do not run this directory as a standalone package or claim it implements the generic gateway adapter interface.

The standalone runnable project is the repository root. Porting this reference requires mapping its tasks and result review to the generic protocol, supplying supported host identity/event capabilities, and implementing the retained platform interfaces. Vendor event compatibility must be independently checked in the target host; this snapshot is not a vendor support promise.

## Isolation

Plugin calls hide context in the frontend; they do not remove underlying context. The maintainer confirms that the current integration cannot establish independent contexts or verifiable tenant isolation. Supported session, memory and tool boundaries must be provided by the dots host and subsequently tested by the adapter; this snapshot cannot guarantee host-internal isolation externally.

The recommended scope is one owner and controlled single-tenant use. Original testing later allowed multiple callers with explicit owner acceptance, but task-record separation, signed input and output provenance checks do not prove isolation of the assistant's private context or tools. This reference does not provide multi-tenant context isolation.

No deployment environment, databases, runtime logs, SSH keys, OAuth credentials, private assistant memory or personal files are included. Historical business identifiers in protocol names remain only to explain the source; they are not requirements of the core project.
