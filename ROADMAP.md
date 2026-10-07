# Roadmap

## Delivered in v0.1.0

- Host-neutral capability/task contract and bounded schema validation.
- Single-process persisted scheduler with scoped roles and task ownership.
- Outbound gateway, heartbeats, deadlines, lease fencing and idempotency.
- Owner pause/resume/revoke and fixed-command/mock adapters.
- Optional reception and mini-program transport helpers.
- Synthetic integration/fault tests, CI, docs and local publication preparation.

## Added locally — 2026-10-06

- Portable Muse binary upload and private caller download with task/lease fencing.
- Optional task or caller + agent context routing, persistent across scheduler restart.
- Refreshed dots 0.4.1 source snapshot and maintainer Muse live-evidence documentation.
- Independent installation, strong host isolation and production storage remain unfinished.

## Next: usable real-host integration

- One supported real assistant adapter, independently reproducible by a new user.
- Host-supported restricted task session, tool allowlist and private-memory exclusion. Current dots isolation is blocked on supported host boundaries; it is not promised as a gateway-only fix.
- Better host cancellation and external-action idempotency evidence.
- Credential provisioning/rotation, scoped short-lived access and opt-in connection lifecycle.
- Portable install and owner status/control surface.
- Three independent users across at least two runtime environments.

## Then: reliable multi-executor operation

- Transactional database/queue store, fair dispatch and overall resource admission.
- Separate executor instance identity and observed capacity.
- Backoff, durable gateway receipts and extended offline/restart tests.
- Retention, deletion, private artifact storage and progress events.
- Metrics and load/failure measurements.

## Optional ecosystem

- Reception/clarification, human review, result provenance and agent recommendation.
- Additional client transports, MCP adapter, vendor-certified host adapters.
- Billing/free quotas, marketplace/catalogue UI and exportable delivery records.

These are planned capabilities, not implemented claims. Vendor adapters must rely on supported APIs and carry their own compatibility evidence.
