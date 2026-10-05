---
name: resilience-drills
description: Design and run bounded backup-restore, failover and recovery exercises with measured recovery objectives, data correctness, abort conditions and cleanup evidence.
---

# Resilience drills

Use for restore/failover exercises or evidence that a recovery plan works. Use
[resilience-rules](../resilience-rules/SKILL.md) for implementation patterns; a drill
tests their operation rather than assuming a configured backup is recoverable.

## Design a bounded exercise

Reuse the recovery plan and establish critical service/data scope, dependency graph,
recovery time objective (RTO), recovery point objective (RPO), clock boundaries and
acceptable correctness. Define environment, permitted fault, blast radius, owner,
abort signals and cleanup. Planning or repository inspection does not authorize a
production outage; use isolated resources unless broader effects are already authorized.

Choose a realistic failure: deleted instance, unavailable region, corrupted backup,
expired credentials, unavailable dependency or interrupted restore. Include the paths
needed to fetch keys, images, configuration and backups during that failure. Do not
make the exercise depend on the component it claims to recover from.

## Measure recovery

Capture last durable source event, backup checkpoint, failure/detection time, restore
start, service readiness and first correct transaction. Measure data loss from recovered
events, and elapsed recovery from the agreed business boundary. Report detection and
restore durations separately when useful. A healthy process or a successful restore
command alone does not prove correct application data, permissions or downstream flows.

Validate referential/business invariants, representative reads/writes and reconnecting
dependencies. Check duplicate replay and lost deferred work with
[data-reconciliation](../data-reconciliation/SKILL.md). Stop on an abort condition;
record partial evidence and restore the prior state within authorization. Verify cleanup,
access revocation and no unintended resource cost or live traffic changes.

## Deliverable and learning hooks

Record scenario, environment/revision, measured RTO/RPO, correctness evidence, aborts,
cleanup, gaps and retest action in the existing recovery plan. Separate tabletop,
simulated and executed recovery. Capture missing dependencies and stale runbook steps.

Reference: [NIST SP 800-34 Rev. 1, contingency plan testing and exercises](https://csrc.nist.gov/pubs/sp/800/34/r1/final).

> **Size budget: 4 KB** — `token-budget.mjs --check`.
