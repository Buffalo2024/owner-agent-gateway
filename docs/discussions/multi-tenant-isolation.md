# Multi-tenant isolation strategies

Ready-to-publish discussion draft. No remote issue/discussion has been created automatically.

## Context

We connected an existing personal assistant through a computer-hosted OAuth/MCP bridge. Controlled tasks, ownership checks, signed inputs, leases, result review and source-only excerpt validation worked. These controls do not isolate private host context and tools.

The intended initial scope is an owner-controlled single-tenant service. Multiple callers must not be advertised as isolated tenants simply because their task records are separate.

The maintainer has verified the live WeChat payment-to-recording flow. That functional success does not resolve isolation: dots plugin calls hide frontend context while underlying context remains present. The current integration offers no verifiable independent contexts. We are asking host developers for supported isolation primitives, not proposing that a gateway or prompt can isolate opaque host memory on its own.

## Controls used in the original experiment

- Capability allowlists and bounded public-text inputs.
- Caller-scoped task records and signed platform task dispatch.
- Lease/attempt fencing, idempotency and cancellation/revocation checks.
- Scoped execution instructions prohibiting private memory/tool access.
- Source-only result checks for the restricted excerpt task and review before publication.

Instructions and result checks cannot prove that a host never accessed private data. Independent OS-level/host-context isolation was not established. The command adapter in this repository uses a separate process and limited environment but is not an OS sandbox.

## Questions for the community

1. Which assistant hosts expose supported per-task sessions with private memory excluded?
2. Can tool credentials and allowlists be enforced independently for each task?
3. Should public execution use a separate assistant instance instead of the owner's normal assistant?
4. How can cross-task leaks be tested reproducibly without real private data?
5. What cancellation and external-side-effect guarantees can adapters realistically provide?
6. Which isolation controls belong to the protocol, gateway, host and operating system?

Please provide documented APIs, versions, synthetic test results and limitations. Separate proposed designs from tested implementations. Do not submit private prompts, account tokens or owner data.
