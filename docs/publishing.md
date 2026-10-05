# GitHub publication checklist

## Prepared locally

- Standalone runnable core with no original private deployment dependency. The optional dots source snapshot retains documented original-platform imports and is not independently runnable.
- English/Chinese README, MIT license, contribution and community policies.
- Protocol, adapters, deployment and isolation documentation.
- Runnable synthetic demo and fault/transport tests.
- GitHub CI, issue templates, pull-request template and ignored runtime data.
- Basic local credential-pattern scan; this is not a full secret/security audit.

## Before uploading

1. Apply the prepared [GitHub metadata](github-metadata.md): planned `Buffalo2024/agent-dispatch`, public standalone repository; check name availability before creation.
2. Close the [license/ownership confirmation gate](license-review.md), including all nine dots snapshot files and any externally contributed materials.
3. Inspect all tracked files; never stage `.runtime`, `.env`, private tests or reports.
4. Run `npm ci`, `npm run check`, `npm test`, `npm run demo`.
5. Inspect `docs/verification.json` and ensure it matches the current tree.
6. Verify README does not claim real-host certification or production readiness.
   Keep maintainer-confirmed live payment-to-recording evidence separate from synthetic CI results. Prominently disclose hidden-but-present dots context and lack of independent tenant contexts.
7. Enable private vulnerability reporting or provide a verified private contact channel.
8. Create the remote repository, set its description/topics and push only after owner authorization.

Repository description, topics and settings are specified in [GitHub metadata](github-metadata.md).

Maintain a standalone Agent Dispatch repository, release history and issue tracker. The root package is intentionally `private: true`: GitHub source distribution is prepared, npm publication is not. This flag blocks accidental npm publication and does not prevent a public GitHub repository or forks.

Recommended first public milestone: three independent users connect their own assistants, across two runtime environments, without a proprietary platform dependency. Document real-host evidence separately from the mock demo.

## Publication status

The public standalone destination is https://github.com/Buffalo2024/agent-dispatch. The maintainer confirmed rights and MIT publication permission for the historical snapshot on 2026-10-05. GitHub source publication does not deploy a live service or change existing production deployments. npm publication and remote discussion creation are not part of this release.
