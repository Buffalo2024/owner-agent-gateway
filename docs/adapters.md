# Adapter authoring

An adapter converts a leased task into a supported invocation of an existing assistant. It must not invent a vendor wake interface or reuse an unsupported private API.

## Interface

```js
export const adapter = {
  id: 'my-host',
  isolation: 'describe actual guarantees and limitations',
  async execute(assignment, {signal}) {
    // Create a task-specific host session and restrict tools/data here.
    // Honour abort where the host supports it.
    return { /* schema-valid output */ };
  }
};
```

`assignment` contains only task data and the frozen capability. Credentials are gateway configuration, not task content. Use the supplied abort signal for deadlines, cancellation and connection revocation.

## Command adapter

Owner selects an absolute executable path and fixed arguments. The task cannot select a command. The adapter runs with no shell, an ephemeral working directory, minimal inherited environment and bounded stdout. Stderr is drained but not returned or logged. The executable receives one JSON envelope on stdin and must emit only one JSON result on stdout.

Any authentication required by a real wrapper must be injected deliberately using the programmatic adapter's explicit environment option or a host-specific secret store. Never pass the entire gateway environment to the child. The default CLI passes no model keys.

Separate process/cwd does not isolate the filesystem, network, OS account or host memory. Descendants are terminated as a group on Unix; Windows process-tree cancellation is not certified. Use an owner-reviewed sandbox for untrusted tasks.

## Compatibility levels

| Level | Evidence required |
|---|---|
| Manual | Owner starts work, task/result protocol works |
| Automatic | Supported wake invocation and real result retrieval |
| Restricted | Automatic plus verified session, tool and data isolation |

Current mock: automatic deterministic demo, task input only, not a real assistant. Current command adapter: automatic process execution, host isolation supplied externally. No vendor host is certified by this repository.

## Certification checklist

- Document supported host/runtime version and public invocation entry.
- Prove task initiation without manual chat messages.
- Prove separate sessions cannot read other task content.
- Prove denied tools and private owner context are inaccessible.
- Test timeout, cancellation, host exit and network loss.
- Test duplicate notifications/claims/results and stale attempt fencing.
- Identify external side effects and their idempotency/cancellation limits.
- Verify credentials never appear in task, result or stderr-derived logs.
- Attach synthetic, reproducible evidence without owner data.

The originating private-assistant experiment is design background, not certification of an adapter in this repository.
