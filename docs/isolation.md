# Permission and isolation model

## Current dots integration: context is hidden, not absent

The maintainer reports that plugin invocation does not display context in the frontend, while underlying assistant context remains present. No verifiable tenant separation or independent contexts are available through the current integration. This is a limitation of this integration, not a claim about every version or possible dots API.

Separate caller subjects, task IDs, leases and result records protect protocol-level ownership; they do not prove host-memory isolation. Do not describe frontend invisibility, prompt instructions or a separate bridge process as a privacy boundary.

Until the host exposes supported independent session/memory and tool-permission boundaries, use dots only personally or within a single trust domain. External code can enforce its own task permissions, but cannot guarantee isolation of opaque host state. Host developers must supply the missing boundaries; adapters must then verify them with synthetic cross-user leak tests before claiming multi-tenant support.

## Default principle

External tasks receive their own supplied material. Private owner memory, email, repositories, calendar, account tokens and filesystem access are not part of the default task contract. Access to any of them requires a separately defined capability and explicit owner policy.

Protocol metadata is descriptive. A host must actually enforce restrictions. The mock adapter uses only its input. The command adapter runs with OS permissions of its account and provides no filesystem/network sandbox. Do not advertise it as isolated.

## Enforcement layers

1. Scheduler: authenticated caller, frozen capability, input bounds, lease and result schema.
2. Gateway: fixed adapter, output bounds, minimal child environment, deadline/abort.
3. Host: independent task session, tool allowlist and private-memory exclusion.
4. OS/container: dedicated account, read-only/explicit mounts, network restrictions and resource limits.
5. Optional result review: provenance, redaction, human approval or domain checks.

Only layers 1 and parts of 2 are implemented generically here. Layers 3–5 require deployment/adapter work. Input/output schemas cannot detect all privacy leaks or guarantee truthfulness.

## Threats and response

| Threat | Current response | Remaining limitation |
|---|---|---|
| Caller reads another task | Caller-subject ownership checks | Credential issuer must assign separate subjects |
| Stale worker submits late result | Lease/attempt fencing | Cannot undo remote side effects |
| Task injects a shell command | Fixed executable, stdin JSON, no shell | Wrapper may still mishandle input |
| Gateway secret leaks to child | No parent environment inheritance | Explicitly supplied host keys need separate protection |
| Private memory enters result | Host isolation required | Generic protocol cannot prove provenance |
| Credential stolen | Role/agent scope and permanent revoke | Static token replacement needs scheduler restart |
| Scheduler files exposed | Restricted files and private directory | No application encryption at rest |

## Data handling

Task input and result are persisted in plaintext in the state file. Treat it as private data, encrypt disks/backups where appropriate, restrict directory access and define retention before live use. Audit includes only task IDs, agent IDs, attempts, event types and times. There is a finite task capacity but no automatic retention cleanup in v0.1.

For a public service, add quotas, an issuer with short-lived credentials, revocation enforcement, secure storage and a privacy review. Those are release gates for public operation, not claims made by this prototype.
