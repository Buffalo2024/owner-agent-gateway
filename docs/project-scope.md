# Scope and acceptance

## Product aim

Agent Dispatch is a standalone project with its own repository and release lifecycle, without a required platform or model.

A personal assistant becomes an owner-controlled callable capability asset: discoverable, executable, measurable and revocable. The project exposes selected capabilities; it does not transfer ownership or automatically expose private context.

## Core acceptance

- A synthetic executor can register, accept a task, report progress and return a schema-valid result.
- Another caller cannot read/cancel that task.
- Only the owner can control the agent; executor credentials cannot submit caller tasks.
- Duplicate delivery and response loss do not create conflicting completions.
- Deadline/retry/cancellation/revocation fence stale execution.
- Core works with both optional plugins absent.
- A command wrapper can connect without changing scheduler business logic.

## What "complete" means for this local package

Runnable reference code, honest capability boundaries, a reproducible test suite and GitHub-ready repository materials. It does not mean a publicly operated production service, a certified private-assistant adapter, measured scale or completed third-party onboarding.

## Origin

The design was informed by an earlier private-assistant bridging experiment. This repository is a clean generic implementation, not an export of that deployment. Original accounts, host-specific callbacks, private memory, business pricing, application IDs and task data are intentionally absent.
