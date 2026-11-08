# Task execution and progress

> **Size budget: 8 KB** — `token-budget.mjs --check`.

Use the [shared task contract](plan-task-breakdown.md) for IDs, task types,
priorities, statuses and context capsules. The existing plan is authoritative;
trackers and agent results refer to its IDs. This reference applies to substantive
plan execution, not every clarification or routine single-step edit.

## Execute a bounded window

Read the current handoff and active task first. Confirm worktree changes, inputs,
dependencies and authorization; then choose the next ready task. Keep only active
work and a few ready next tasks in the live tracker. The full backlog stays in the
plan. Do not reload the complete history or reproduce the backlog after compaction.

When a task reveals new work, add it to the same plan with a new stable ID and
explicit dependencies. Preserve its original outcome and other agents' changes.
Explain a material scope or ordering change. Do not silently drop acceptance,
integration, compatibility, documentation or required security checks.

## Bound sustained work

Give each substantive work block one observable outcome and a stopping condition:
verified delivery, a useful checkpoint, or an evidenced external blocker. Reuse
the active task's acceptance; do not create a separate plan or budget questionnaire.
During sustained work, review progress and reported context about every 60 minutes
and at milestones. This is a checkpoint default, not a forced timeout or a claim
that a hook measures elapsed time. Continue authorized work that is making progress.

- Keep normal working context below 150K when the client exposes token usage;
  consider a checkpoint around 100K before the next large investigation. These
  are operating targets, not vendor limits or guaranteed caps. Use the runtime's
  supported compaction; do not reduce its window blindly or confuse a tool-call
  counter or bytes/4 estimate with measured context. If context refills immediately
  after compacting, find and bound the repeated input rather than compacting in a loop.
- After two unsuccessful attempts at the same approach, review the failure and
  name a changed hypothesis, input or method before another attempt. Do not repeat
  the same failing command or re-audit unchanged work without new evidence. Pursue
  viable alternatives; an attempt limit does not waive required acceptance. When
  an external prerequisite prevents progress, record the evidence and recovery
  action, then yield instead of generating repeated blocked turns.
- For CI, deployments or other external waits, use one bounded tool-side watch
  with a deadline appropriate to the job; default to a 10-minute observation
  budget when none is known. Preserve the job ID, state and resume command if it
  expires. Handle timeout separately from failure or success. Do other ready work
  or return the handoff; do not poll unchanged status with repeated model turns.
  Follow the runtime's per-call wait limits and keep user updates timely.
- Do not create recurring model-driven monitoring by default. A requested loop
  needs a purpose, interval, deadline, owner and completion/cancellation condition;
  use deterministic CI/events where suitable. End task-owned helpers and watchers
  on completion. Do not terminate other user sessions or unrelated processes.
- Search before reading; return relevant excerpts and check summaries, with full
  logs in files. Aim for at most 2K returned tokens per routine tool result when
  supported. Narrow or chunk larger required evidence before the next read rather
  than relying on silent truncation. Inspect every result of batched checks;
  record actual terminal status. Reuse evidence only for unchanged relevant inputs.

At a boundary, replace the current handoff with the compact record below. Aim for
300–600 words or less; required acceptance, uncertainties and exact next actions
take precedence over that target. Link logs and historical evidence, not full tool
output. Resume related work from this record. Start a fresh session for unrelated
work or stale context after a long break. Use actual client controls; never claim
to run `/compact`, `/clear` or a new session when they are unavailable. Do not
abandon a required fix just to meet a time/context target. Finish when acceptance
passes; keep a partial task and its remaining work explicit across sessions.

## Update evidence and state

After verification finishes, update the task's status and checkbox with its actual
result and evidence link. An implemented task with tests pending remains
`in_progress`; a running command is not evidence of success. Record failed/skipped
checks and what remains uncertain. Valid checks for unchanged inputs can be reused
by reference; compaction alone does not invalidate them.

A native tracker may use `completed` for canonical `done`. Keep unsupported states
and their reasons in the plan as described in the task contract. Deferred/cancelled
items are visible scope decisions, not delivered outcomes. Task blockers name the
unavailable prerequisite and next recovery action. Distinguish local tests from
integration, installation, deployment and runtime verification.

## Meaningful progress communication

Tell the user the concrete finding/change, why it matters, checks completed and the
next action. Name task IDs when they clarify a longer plan. Report material blockers
promptly with their evidence and recovery direction; label suspected causes as
hypotheses. Do not narrate every tool call or repeat all division introductions.
For a commit milestone, record the branch and SHA; for a deployment, record the
actual target/revision and verification. A proposal or started operation is not a
completed effect. Do not introduce another approval gate when authorization exists.

## Compact handoff

Replace the current handoff at meaningful milestones and before yielding or
compaction. Keep it short enough to read with the active task in one focused turn:

```text
Goal and accepted constraints: ...
Active task: <ID>, <status>; exact partial work remaining: ...
Worktree/branch/commit: ...; uncommitted changes and other owners: ...
Key inputs/decisions: <links to relevant sections/artifacts>
Verified: <completed outcomes, checks, revision/input and evidence paths>
Remaining checks/blockers: ...
Next action: <ID, exact file/command/decision and expected outcome>
```

Avoid copying this narrative into multiple plans and memories. Keep long logs and
historical decisions in linked artifacts. A delegated helper receives only its
relevant task capsule, permitted effects and output bound; its findings return to
the main owner for integration into the same plan. On resume, verify current files
before relying on a summary; read additional detail only for the next action.
