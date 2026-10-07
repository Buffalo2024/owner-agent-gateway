# Deployment and operations

## Local/private deployment

Use Node.js 24+, one scheduler process and one private state directory. Default bind is `127.0.0.1:8787`. Keep configuration and credentials outside the repository for a persistent installation. Set `AD_CONFIG` and `AD_STATE` to absolute paths.

The gateway polls the scheduler outbound and needs no incoming port. It works only while its process, host and network are available. Install an OS service for startup/restart if desired; service templates are not yet certified. Owner-local pause controls differ from server revocation.

## Remote deployment

Place the scheduler behind a TLS reverse proxy, keep its internal port private and forward the Authorization header. The SDK refuses remote HTTP by default. Configure timeouts/body limits and rate limits in the proxy. Do not log authorization headers, task bodies or returned results. No cookies/CORS are required for the Node or WeChat transports.

Never publish `.runtime/credentials.json`. Config uses token hashes; callers/executors still need their own plaintext credential through a secure channel. There is no provisioning web UI, OAuth server or expiry/refresh workflow in this version. For a mini-program, provide an authenticated application backend that issues one caller credential per user or proxies requests with equivalent ownership checks. Do not compile shared credentials into a client app.

## Storage and concurrency

The reference state file is for single-process, bounded workloads. It is not safe to run multiple scheduler writers against one file. Atomic rename handles process-level partial writes; fsync-based power-loss durability is not implemented. Back up while stopped or after draining state writes. To scale, replace the store with a transactional database, queue indexes and lease fencing while preserving API semantics.

The reference worker executes one assignment at a time. The scheduler enforces capability concurrency across executor instances. It does not yet implement overall owner quotas, fair scheduling or resource reservation.

## Controls

- Pause: rejects new submissions and new claims, current valid work may finish.
- Resume: restores paused admission.
- Revoke: cancels pending/running tasks, blocks that agent's executor requests permanently. A new ID and credential are required to reconnect.
- Caller cancellation: fences the result; host cancellation is cooperative and observed on heartbeat.
- Gateway offline: queued work waits until its deadline; abandoned leases retry within the attempt bound.

## Monitoring

`/health` confirms process health, not assistant capability health. Discovery reports recent observed contact; offline does not mean revoked. Audit is metadata-only. Worker logs fixed event names; do not add task content or raw adapter exceptions to logs. Add metrics for queue delay, leases, deadline failures and completion rates before live traffic.

## Before public service

Complete the [security model](../SECURITY.md), a real-host isolation test, per-user credential lifecycle, admission/rate limits, retention policy, storage migration and load tests. A successful local demo is not a public production readiness statement.

## Optional file store and contexts

Set `AD_FILES` to a dedicated private directory before starting the scheduler to enable result uploads/downloads. Give only the scheduler OS account access, protect backups, and provide disk quotas/retention. Preserve state and file storage together during backup/restore; do not run multiple scheduler processes against the JSON files. Configure the reverse proxy for the 10 MiB binary limit and sufficient upload timeouts. No deployment occurs from installing the source.

Choose owner registration `contextMode` explicitly for Muse routing. NONE preserves legacy behavior; TASK is per task; CALLER_AGENT persists one chat routing key per authenticated caller + agent. Use stable caller subjects, never display names. These are routing choices and not privacy isolation. Follow the [Muse guide](../adapters/muse/README.md) for the current live-evidence scope and host setup.
