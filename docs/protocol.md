# Agent Dispatch protocol 0.1

Experimental wire contract. Breaking changes are permitted before 1.0 and must be documented.

## Transport and authentication

JSON over HTTPS. Loopback HTTP is allowed for local testing. `Authorization: Bearer <credential>` is required except for `/health`. Credential roles: owner, caller, executor. Unknown body fields are rejected. Body limit: 128 KiB. No CORS or cookie-based authentication is provided. Never put credentials in task fields, query parameters, prompts or logs.

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
| GET | `/v1/audit` | owner | Metadata for owned agents |

## Agent and capability

Registration fields: `id`, `name`, `capabilities`. Capability fields: `id`, `version`, `title`, `inputSchema`, `outputSchema`, `permissions`, `execution`. See [public-summary.json](../protocol/public-summary.json).

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
