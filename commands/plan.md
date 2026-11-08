---
name: plan
description: Restate the outcome, inspect existing work and refine the authoritative plan into small verifiable tasks with stable labels and bounded handoffs.
---

# Plan command

> **Size budget: 8 KB** — `token-budget.mjs --check`.

Use the [planner guidance](../agents/planner.md) and
[shared task contract](../rules-library/council-detail/plan-task-breakdown.md).
The same contract applies to Claude Code and Codex; tool availability differs.

1. Locate the authoritative plan and read its current handoff and relevant tasks.
   Inspect affected paths/contracts and use existing accepted decisions.
2. State the concrete outcome and material constraints. Ask only missing questions
   that block a useful next step.
3. Break the work into small outcome-based tasks with stable IDs, canonical types,
   separate priorities/statuses, owned scope, context, dependency IDs, acceptance
   and verification. Preserve existing task IDs and explicit commit/delivery policy.
4. Check coverage, cycles, ownership conflicts and integration outcomes. Keep
   required tests with the change they prove; split genuinely separate outcomes.
5. Update the same plan in place with a compact handoff and next executable task.
   Summarize the breakdown, material decisions and blockers for the user.

A request only to plan produces a plan, without implementation. When the user has
already authorized implementation, planning does not impose a new confirmation
gate. Follow the user's scope and existing authorization; never infer push,
deployment or external-service access from this command.

Keep only the active task and a few ready tasks in an available live tracker,
using the plan IDs. Do not mirror the full backlog into each turn, create versioned
helper plans or require an exhaustive intake for a routine fix. Exact verification
commands must come from repository evidence; a planning draft is not a passing test.
