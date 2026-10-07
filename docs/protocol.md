# Owner Agent Gateway protocol 0.1

Experimental wire contract. Breaking changes are permitted before 1.0 and must be documented.

## Transport and authentication

JSON over HTTPS. Loopback HTTP is allowed for local testing. `Authorization: Bearer <credential>` is required except for `/health` and explicitly enabled public boolean signals. Credential roles: owner, caller, executor. Unknown body fields are rejected. Body limit: 128 KiB. No CORS or cookie-based authentication is provided. Never put credentials in task fields, query parameters, prompts or logs.

| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/health` | none | Process health |
| GET | `/v1/agents` | authenticated | Capability discovery |
| POST | `/v1/agents` | owner | Register/update own agent |
| POST | `/v1/agents/:id/control` | owner | `pause`, `resume`, `revoke` |
| POST | `/v1/tasks` | caller | Submit; `Idempotency-Key` required |
| GET | `/v1/tasks/:id` | owning caller | State/result |
| DELETE | `/v1/tasks/:id` | owning caller | Cancel |
| POST | `/v1/executor/claim` | executor | Claim next task for credential-bound agent |
| POST | `/v1/executor/tasks/:id/heartbeat` | executor | Renew lease |
| POST | `/v1/executor/tasks/:id/result` | executor | Submit success or failure |
| POST | `/v1/executor/tasks/:id/files` | executor with current lease | Upload task-generated raw bytes (opt-in store) |
| GET | `/v1/tasks/:id/files/:artifactId` | owning caller | Download files referenced in the successful result |
| GET | `/v1/audit` | owner | Metadata for owned agents |

## Agent and capability

Registration fields: `id`, `name`, `capabilities`, optional `contextMode` (`NONE` default, `TASK`, `CALLER_AGENT`). Omitted updates preserve the prior mode. Accepted tasks freeze their server-owned context; changing registration affects future tasks only. Capability fields: `id`, `version`, `title`, `inputSchema`, `outputSchema`, `permissions`, `execution`. See [public-summary.json](../protocol/public-summary.json).

`permissions.data` is `task-only`; `permissions.tools` declares required host tools. These declarations do not grant OS or host permissions. An adapter must enforce them in the host or be explicitly classified as unisolated. Runtime/tool policy cannot be implemented by a prompt alone.

`execution.maxConcurrency` is enforced per agent/capability across valid leases. `timeoutSeconds` bounds each attempt; `maxAttempts` bounds lease-expiry retries. The gateway reference worker processes one task at a time. Overall per-agent quotas and distributed capacity control are future extensions.

## Task submission

```json
{
  "agentId": "my-agent",
  "capabilityId": "public-summary",
  "capabilityVersion": "1.0.0",
  "input": {"text": "Public material supplied by the caller."},
  "deadlineSeconds": 3600
}
```

The scheduler freezes the selected contract and validates input. Idempotency keys are scoped by caller. Reusing a key with different input returns `IDEMPOTENCY_CONFLICT`. A paused agent rejects new submissions. Offline agents may receive queued tasks until the overall deadline.

States: `QUEUED -> CLAIMED -> RUNNING -> SUCCEEDED | FAILED | CANCELLED`. Lease expiration may return to `QUEUED`; maximum attempts/deadline cause `FAILED`. Explicit executor errors are terminal in v0.1. Success means a schema-valid executor result; it does not imply human acceptance or semantic correctness. Review is an optional extension.

## Lease and receipts

Claim body: `{ "claimRequestId": "unique-request-id" }`. The response is `{ "assignment": null }` or a leased assignment with `taskId`, `attempt`, `leaseId`, `leaseExpiresAt`, `attemptDeadline`, `capability` and `input`. A retry with the same key recovers a still-valid lease. Once expired, the old proof never authorizes a result.

Heartbeat body: `{ "attempt": 1, "leaseId": "..." }`. Scheduler time is authoritative. Renewals never extend the immutable attempt deadline or task deadline. Reference gateway clocks should be synchronized.

Result body:

```json
{
  "attempt": 1,
  "leaseId": "returned-lease-id",
  "submissionId": "unique-submission-id",
  "result": {"points": ["A source excerpt."]}
}
```

Provide exactly one of `result` or `error`. Fixed executor error codes: `EXECUTION_ERROR`, `TIMEOUT`, `INPUT_UNUSABLE`, `ADAPTER_UNAVAILABLE`. Retry an uncertain result using the same submission ID and identical payload. Changed payloads are rejected. Owner revocation rejects further executor requests even if a receipt previously existed.

## Schema subset

Supported types: object, array, string, boolean, number, integer. Supported keywords: `type`, `properties`, `required`, `additionalProperties`, `items`, `minLength`, `maxLength`, `minimum`, `maximum`, `minItems`, `maxItems`, `enum`. Objects must use `additionalProperties:false`. Strings and arrays require explicit maximum lengths. Nesting is bounded to 12. Unknown keywords are rejected. Unicode code points are counted for strings.

This is not a full JSON Schema implementation; `$ref`, unions, regex, formats and conditional schemas are unsupported. The bundled schema documents use only this subset.

## HTTP errors

Authentication failures: 401. Role/revocation failures: 403. Hidden or missing resources: 404. Lease/idempotency/state conflicts: 409. Capacity: 429. Input/schema validation: 400. Oversized request: 413. Unexpected internal errors: 500 with no stack or private data.

Important codes include `AUTH_REQUIRED`, `FORBIDDEN`, `NOT_FOUND`, `SCHEMA_MISMATCH`, `UNKNOWN_FIELD`, `AGENT_PAUSED`, `EXECUTOR_REVOKED`, `STALE_LEASE`, `IDEMPOTENCY_CONFLICT`.

## Optional context routing

`assignment.context` has `contextKey`, `mode` (`NEW` / `CONTINUE`), and `taskId`. CALLER_AGENT binds the authenticated caller + agent persistently; TASK creates a fresh key. Retries retain their original context. Optional submission `previousTaskId` is valid only in CALLER_AGENT mode for a task owned by the same caller and agent; it cannot switch the persistent binding. Caller input context is never adopted as server-owned routing metadata. The core does not inject prior history or enforce host memory/tool boundaries. Separate side chats and routing do not establish isolation.

## Optional result files

Enable the owner-selected `AD_FILES` directory when starting the scheduler. See [public-task.json](../protocol/public-task.json) for a bounded file-result contract. Upload raw bytes with `Content-Type`, URL-encoded `X-File-Name`, `X-Task-Attempt` and `X-Task-Lease`. Files are private/task-scoped, at most 10 MiB each and 8 distinct files per task, including across attempts; identical uploads are idempotent. A lease is checked before and after storage.

File result: `{taskId, inputHash, text?, files:[artifactId]}`. Assignment includes scheduler-computed canonical `inputHash`; Muse/Node helpers fill the task binding. Result references require actual uploads from this task. Header/type/size/SHA256 checks detect basic mismatches, not complete format validity, semantic quality or malicious content. Expected-output media keywords require matching files; this is a conservative guard, not semantic validation. Final human acceptance is a separate optional workflow.

Only the owning caller may download files referenced by a successful result. Binary transport has a 60-second helper timeout; JSON calls retain 15 seconds. Downloads have attachment disposition and no-store/nosniff headers. Retention, disk quotas, malware scanning, abandoned-upload cleanup, host file access and network isolation remain operator responsibilities.
