# Muse hook + HTTPS adapter (experimental)

This is a portable outbound adapter for a personal Muse workspace. It uses workspace skills, host hooks and Secure Vault surrogate-authenticated HTTPS; no custom MCP registration, unofficial cookie/session API or inbound Muse address is assumed.

## Current verification status — 2026-10-06

Two scopes must remain distinct:

- **Original controlled deployment, maintainer-verified:** real Vault authorization, natural 300-second hook wake, main-agent dispatch, claim/renewal, fresh task-side-chat creation, task-agent heartbeat handoff, reasoning and accepted result submission succeeded without manual claiming. Later deployment added a persistent caller + agent side-chat binding and real video file upload/import. User acceptance records exist; financial settlement is still in progress. This is one maintainer account, not vendor certification or repository CI replay.
- **This repository:** generic Python claim/heartbeat/result and binary file upload, scheduler artifact validation/download, caller + agent context persistence, ownership checks, lease fencing and failures are tested with synthetic local data. Header-only media fixtures test transport, not real media generation. A new operator must deploy the scheduler, authorize their own provider, install/configure the skill and verify their host lifecycle. Copying files does not establish live authorization.

See [evidence summary](../../docs/muse-evidence.json) and [historical troubleshooting](../../docs/muse-troubleshooting.md). VM replacement recovery, strong memory/tool isolation, stable wake latency and independent installations remain unverified.

## Shape

Caller → scheduler → public boolean availability probe → Muse hook → full main agent dispatch → user task side chat → authenticated upload/result → caller download.

The probe reserves nothing and includes no task body, caller ID or queue count. Empty checks are silent. The tested deployment uses a 300-second polling interval; idle arrival can wait roughly one interval plus host scheduling. It is polling, not push. No extra health/performance poller is required. Heartbeats during a leased task remain necessary.

## Owner setup

1. Deploy the generic scheduler behind HTTPS. Create separate owner/caller/executor credentials, one authenticated caller subject per user, and bind the executor to its agent ID. Register only owner-approved capabilities.
2. For file tasks, set `AD_FILES` to an owner-selected private directory before starting the scheduler and register the bounded [public-task contract](../../protocol/public-task.json). Without `AD_FILES`, binary endpoints are disabled. Protect the JSON state, files and backups; provide retention manually. No distributed storage or antivirus service is supplied.
3. Choose an optional registration `contextMode`: `NONE` (default), `TASK`, or `CALLER_AGENT`. The latter persists one context per authenticated caller + agent. Context is server-owned `assignment.context`, never a client nickname/avatar. It routes chats; it does not grant permission to history or isolate host memory.
4. Explicitly enable a public signal in owner configuration: `publicSignals: [{"channel":"owner-selected-channel-at-least-16-chars","agentId":"muse-one"}]`. GET `/v1/signals/<channel>` returns only `{"available":true}` or false. Disabled by default. The channel is a public route, not a credential, and exposes task timing. Use proxy limits.
5. Copy `SKILL.md`, `client.py` and `probe.sh` into owner-controlled Muse workspace locations. Validate current official host tool schemas. Request your custom provider using the host's `credentials.request_api_access` flow and let the owner enter the key on its authorization page. Never put a key in chat, stdin, arguments, source or hook configuration. `client.py` supports the host-owned `/opt/hatch/skills/skill-creator/bin/dynamic_credentials` surrogate helper. No real key is bundled.
6. Put only non-secret `AD_SIGNAL_URL` in the hook script, source `$HATCH_HOOK_RUNTIME`, start disabled, dry-run, then enable with owner authorization. The tested host uses main delivery `[{"surface":"main"}]` and omits `to`; the thin hook emits a body-free wake hint. Main-agent dispatch creates/reuses the side chat and stays alive until the task agent acknowledges heartbeat ownership. Verify these tools on your installed host; a send receipt is not completion.
7. Verify real queue → natural wake → dispatch → leased side-chat execution → upload → result → caller retrieval. Also test idle silence, pause, revocation, stale leases, transfer timeout and restart. Use a lease appropriate to your host; the generic demo's short defaults are not a production configuration.

## File delivery

`client.py` reads one stdin JSON object; `provider` identifies the owner-authorized Vault connector. `token` mode is for local synthetic tests only.

- `claim`: `claimRequestId`.
- `heartbeat` / `heartbeat-loop`: `assignment`.
- `upload-file`: `assignment`, `filePath`, `mimeType`, optional `fileName`. Upload only files generated for this approved task. Raw bytes go to `/v1/executor/tasks/:taskId/files` with attempt/lease headers; stdout returns an artifact descriptor.
- `result`: `assignment`, `submissionId`, exactly one of `result` or `error`. File results use `{"text":"optional explanation","files":["uploaded artifactId"]}`; the client binds `taskId` and `inputHash` from the assignment. Retain the same submission ID and payload for retries.

File limit: 10 MiB each, 8 distinct uploaded files per task. Video, audio, images, PDF, Office, text and archives have a MIME allowlist and basic byte/header checks. SHA256 and size are checked; these checks do not prove full format validity, playability, semantic quality or safety. Required media files cannot be replaced by a TXT explanation. Result references must belong to this task. Callers download only completed-result files through authenticated `/v1/tasks/:taskId/files/:artifactId`; no public file bearer URL is issued by the generic scheduler. Node SDK equivalents are `uploadFile` and `downloadFile`.

## Task conversations and isolation

Every task is routed to an execution side chat, but not necessarily a newly created one. In the deployed caller + agent policy, the first task creates that user's chat; subsequent tasks from the same authenticated user and same agent continue there. `TASK` is the alternative for fresh per-task routing. This Muse chat behavior is not implemented by the dots plugin reference and must not be advertised as shared host behavior.

`CALLER_AGENT` reuses the same server-bound context for new task IDs by the same caller; different callers and agents receive different keys. `TASK` creates a fresh context per task. Retries retain the accepted task's original context. Use a local contextKey → sideChatId mapping; never infer identity from nicknames or merge histories. Every task keeps its own lease, attempt, result and receipt.

**Separate side chats and routing bindings do not establish host-internal memory, filesystem or tool isolation.** The generic scheduler neither injects history nor enforces Muse memory boundaries. Reusing a chat can make same-user prior context available inside the host; only use history explicitly authorized by the owner and current capability. Restrict current use to controlled, non-sensitive tasks in one trust domain until host isolation is verified.

Temporary stop: scheduler owner `pause` plus `hooks.disable`. Resume both explicitly. Permanent stop: owner `revoke`, disable/remove the hook and revoke its Vault credential. Removing the hook alone does not revoke scheduler authorization. The main dispatcher may show operational metadata only; task reasoning and output stay in the side chat.
