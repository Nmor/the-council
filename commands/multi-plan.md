---
name: multi-plan
description: Combine explicitly requested independent planning perspectives into the same authoritative plan using the shared actionable task contract.
command: true
---

# Collaborative planning

> **Size budget: 11 KB** — `token-budget.mjs --check`.

$ARGUMENTS

Follow [planner guidance](../agents/planner.md) and the
[shared task contract](../rules-library/council-detail/plan-task-breakdown.md).
This planning-only command does not modify production code or grant permission
for external services. Claude wrapper names and third-party backends are optional
integration conventions, not native Codex capabilities.

## Bounded collaboration

Locate the existing authoritative plan; read the current handoff and affected task
section rather than the whole history. Inspect only relevant paths/contracts. Use
available local search when a connector is unavailable. Preserve the user's
requirements; an enhancement tool or another model cannot replace their scope.

Use the main session by default. Where another perspective is explicitly requested
or a concrete independent investigation warrants it, use one available specialist
at a time under the runtime's delegation contract. Give it the bounded objective,
owned/readable paths, relevant decisions/dependencies, acceptance evidence and
output limit. Planning helpers return proposals and evidence; the main owner updates
one plan. No model has automatic authority over a domain based on its vendor/name.
Do not invent tools, demand a fixed model, recursively retrieve the whole project
or automatically launch parallel model sessions.

## Integrate into one plan

Compare the proposals against repository evidence and accepted constraints. Resolve
conflicts explicitly; consensus alone is not verification. Convert useful proposals
into small outcome-based tasks using stable IDs, canonical types, separate priority
and status, scope/context, dependency IDs, acceptance and verification. Domain tags
such as frontend/backend are not types or model-routing instructions.

Preserve existing IDs, issue mappings and delivery policy. Check dependency cycles,
shared-file ownership and producer/consumer compatibility. Record unanswered
questions as bounded investigation tasks instead of pretending implementation is
ready. Update the same plan in place; no `-v2` plans or helper backlogs.

Deliver a compact handoff naming the next ready task, worktree/commit, input/decision
links, pending checks and blockers. Identify which analysis was independently
performed and which integrations were unavailable. If an optional backend exposes
a reusable session ID, retain it only as a reference; the handoff must remain usable
without that session. Stop after the requested plan is delivered. Later execution
follows the user's authorization and the same task IDs.
