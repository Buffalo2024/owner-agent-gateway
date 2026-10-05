# Security policy

## Status

Version 0.1.x is experimental. Do not expose a private assistant to untrusted callers without verified host/tool/data isolation. There has been no independent security audit.

For the current dots reference, frontend context invisibility does not mean context is absent. Independent contexts and tenant isolation are not established. Restrict use to personal or single-trust-domain operation; do not promise cross-user confidentiality based on task ownership checks alone.

The core implements role/subject checks, task ownership, leases and bounded schemas. It does not provide a filesystem or network sandbox, model safety guarantees, encryption at rest, automatic token refresh, a credential issuer or production admission control.

## Reporting

Once published on GitHub, use the repository's **Security → Report a vulnerability** feature if private reporting has been enabled. If unavailable, open an issue requesting a private contact channel without exploit details, credentials or private task data. Maintainers must enable private reporting or publish a verified contact channel before public launch. No unverified email address is supplied here.

Reports should include affected version, reproducible synthetic steps, impact and a proposed fix if available. Never submit real owner data. Avoid testing against other people's services.

## Operator responsibilities

- Separate owner, caller and executor credentials; assign one caller subject per user.
- Use TLS remotely and protect state/configuration/backups.
- Enforce host session/tool/data restrictions, not only prompts.
- Keep fixed executable selection under owner control.
- Configure input admission/rate limits, resource budgets and retention.
- Rotate compromised credentials and restart the reference scheduler; permanently revoke affected agents.
- Verify remote cancellation and external side-effect limits for each adapter.

See [isolation](docs/isolation.md) and [deployment](docs/deployment.md).
