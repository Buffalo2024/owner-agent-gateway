# Muse historical troubleshooting

These failures predate the currently verified controlled deployment. They are not the current connection status, and the generic repository tests do not replay a live host.

- Hook sub-workers returned `Unknown tool` for `chat.create`. They must emit a wake hint to a supported full chat agent rather than claim work they cannot route.
- Side-chat summary delivery did not reliably start a full agent. Main delivery was separately tested, then verified through a natural 300-second polling cycle.
- Background processes were cleaned up when the owning agent run ended. A dispatcher now keeps its run alive until the side-chat agent starts its own heartbeat and acknowledges handoff.
- A new side chat once started much later than expected. A send receipt did not prove execution; old leases were rejected. Keep the bounded transfer timeout and never reuse expired assignments.
- A requested video was initially returned as TXT. Transport success was not task completion. The controlled deployment was repaired with binary upload and actual video-file delivery; the generic scheduler now checks required file kinds and task-bound references. Semantic quality still requires human review.

Current outcome: real authorization, natural wake, main dispatch, side-chat execution and result submission have maintainer evidence. Host memory/tool isolation, predictable wake latency, independent-account reproduction and VM replacement recovery remain unverified. See [current adapter status](../adapters/muse/README.md).
