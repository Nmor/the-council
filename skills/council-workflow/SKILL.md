---
name: council-workflow
description: Diagnose Council context overload or stalled workflows and tune task routing, bounded evidence and handoffs while preserving required checks and active user sessions.
disable-model-invocation: true
---

# Council workflow efficiency

Use for repeated compaction, duplicated reviews, excessive routing or stalled Council
work. This skill complements [council-maintenance](../council-maintenance/SKILL.md), which
maintains the library and learning process. It does not require an all-division ceremony.

## Diagnose before changing configuration

Inspect only the current handoff and relevant plan section. Measure discovery descriptions,
instruction loading, hook output, tool output and recurring reads separately. Compare a
small representative task before/after; bytes are not measured tokens. Distinguish a
large fixed instruction floor from growth after compaction. Search paths and metadata
before reading content; keep long logs in artifacts and return the useful excerpt.

Do not fix overload by disabling security checks, required tests, native compaction,
memory or all hooks. Do not reset or kill another user's session. Inspect the installed
runtime and its supported settings before changing them; Claude and Codex differ. Read
the relevant native compatibility guidance only when that difference matters.

## Keep one working thread

Use the main session by default. A concrete independent investigation can justify one
bounded specialist with explicit objective, paths, permitted effects, evidence and output
limit; do not recursively delegate or load the whole library. Reuse valid evidence for
unchanged code and avoid repeating intake after compaction.

Maintain one authoritative project plan. Its compact handoff records objective, accepted
constraints, active task ID/status, worktree, commits, evidence, remaining work and
the exact next action. Use the [shared task contract](../../rules-library/council-detail/plan-task-breakdown.md)
to split oversized work and give each task only its necessary context and acceptance.
Keep only active work and a few ready tasks in the live tracker. Update the handoff
in place rather than appending the full conversation or a second plan. Keep
unrelated history on disk. Resume from this handoff without treating a summary as proof
of execution. A started command is not a passed check.

For sustained work, apply the shared [execution discipline](../../rules-library/council-detail/plan-execution-progress.md#bound-sustained-work):
hourly checkpoints, evidence-based retries, bounded external waits and explicit
completion. Distinguish instruction targets from runtime-enforced limits; no hook
in this skill automatically clears a session or enforces an account-wide budget.

## Verification and learning hooks

Compare context use and task completion on a representative task. Label a simulated
compact cycle separately from a real runtime event. Preserve user configuration and
authorization. Record the specific repeated read/output that caused overload and the
smallest confirmed correction; stop tuning when the task succeeds.

Runtime references: [Claude Code costs and long sessions](https://code.claude.com/docs/en/costs)
and [context and compaction](https://code.claude.com/docs/en/how-claude-code-works).

> **Size budget: 4 KB** — `token-budget.mjs --check`.
