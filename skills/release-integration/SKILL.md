---
name: release-integration
description: Coordinate dependent repositories, migrations, infrastructure and releases with compatibility evidence, deployment ordering, rollback limits and exact revision tracking.
---

# Release integration

Use when a release spans repositories or depends on infrastructure, schema, identity,
configuration or model changes. For one independent deploy, use the project's usual flow
and [deployment-patterns](../deployment-patterns/SKILL.md) when needed.

## Establish the release state

Inventory only affected components: worktree, branch, local commits, PR, reviewed head,
CI head, artifact digest, target environment and deployed revision. Distinguish committed,
pushed, merged, built, applied and serving. Respect existing push/deploy authorization;
reviewing a release does not itself authorize external mutations.

Map producer/consumer dependencies, identity permissions and feature activation. Record
required order and a compatibility matrix for old/new producer and consumer combinations
that will coexist. Test representative existing consumers, not just the changed path.
Use additive changes, staged activation or expand/contract migrations where appropriate.
An apply succeeding does not prove workloads are ready; a merge does not prove deployment.

## Verify the transition

Check required reviews, resolved comments and CI against the exact intended revision.
Reuse unchanged evidence; rerun when code, environment or contract changes invalidate it.
For infrastructure, inspect the plan and record applied state before dependent activation.
Verify configuration and runtime readiness against the deployed artifact.

Define rollback/roll-forward steps and limits for irreversible migrations, financial
effects or incompatible state. Prefer a small representative rollout with explicit health,
correctness and latency observations. Stop an authorized rollout when those criteria fail;
do not repeatedly retry an unsafe transition. Preserve a revision/evidence map in the
existing release plan, with unfinished steps and the next action.

## Learning hooks

Capture dependency, compatibility or rollback gaps exposed during release. Update the
project's existing checklist only when the finding applies beyond this one release.

References: [Google SRE canarying](https://sre.google/workbook/canarying-releases/)
and [NIST SP 800-218 v1.1, PS.2 and PS.3](https://csrc.nist.gov/pubs/sp/800/218/final).

> **Size budget: 4 KB** — `token-budget.mjs --check`.
