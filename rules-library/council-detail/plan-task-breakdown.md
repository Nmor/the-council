# Actionable task contract

> **Size budget: 17 KB** — `token-budget.mjs --check`.

This is the shared planning contract for Claude Code, Codex, specialists and
project plans. Keep project facts in the existing authoritative plan. Load this
reference when authoring, reviewing or resuming substantial planned work; it is
not an instruction to load the entire plan or launch more agents.

## Decompose by outcome

For substantive plans, use the [principal quality contract](principal-level-mandate.md)
to connect requirements, invariants, design/tool decisions and meaningful evidence.
Every required outcome must survive decomposition, including difficult failure and
consumer checks. A task is not ready while a decisive capability/design assumption
remains unverified; make that unknown a bounded prerequisite investigation.

A task produces one useful outcome that one owner can implement and verify with
a bounded set of inputs. Name the outcome with a verb and object: "Reject a
duplicate event before charging" rather than "Work on payments".

Split a task when it has independently verifiable outcomes, different owners or
authorization boundaries, unresolved decisions that change its implementation,
or more relevant context than a focused work session can retain. Turn an unknown
into an investigation with a decision or evidence deliverable; do not invent
file paths, timings or implementation details to make the plan look complete.

Keep a change and the tests needed to prove that change together when separating
them would leave an unsafe or unusable intermediate state. A separate verification
task is useful for a cross-service seam, independent review or release exercise.
Include affected wiring, compatibility, documentation, UX/accessibility and cleanup
in the relevant outcome or in explicit dependent tasks. Cleanup requires evidence
that consumers have migrated; an unfinished capability is not automatically bloat.

Phases group outcomes and may have sub-steps when useful. Neither a fixed hierarchy,
minimum task count nor a duration quota determines correctness. Routine fixes may
need only a short checklist. Large work should expose its dependencies and small
deliverable slices without creating hundreds of speculative tasks.

## Stable labels

Use the same IDs in the plan, tracker, review, evidence index and agent handoff.
Preserve existing IDs and issue keys; record an alias once if normalization is
needed. Never renumber completed or referenced tasks. Moving a task between phases
does not change its ID. Plan IDs and task priorities are separate fields.

For a new Council plan, choose an unused `P<n>` identifier in that plan's namespace.
Use `P<n>.TASK.<sequence>` for new task IDs, for example `P12.TASK.3`. The sequence is
monotonic within the plan, not a priority or execution order. Existing typed IDs
such as `P9.C.8` remain valid. Grouping and artifact labels may use:

| Artifact | Label | Example |
| --- | --- | --- |
| Plan | `P<n>` | `P12` |
| Phase or wave | `P<n>.PH<k>` or `P<n>.W<k>` | `P12.PH2` |
| Task | `P<n>.TASK.<sequence>` | `P12.TASK.3` |
| Gap, finding, review | `P<n>.GAP<k>`, `P<n>.F<k>`, `P<n>.RV<k>` | `P12.F1` |

When only a plan excerpt is loaded, search its label metadata to find unused IDs;
do not read the entire history just to allocate a sequence. The main plan owner
reserves IDs in the authoritative plan before handing tasks to workers and
coordinates concurrent additions. Draft IDs remain provisional until checked.

When splitting a referenced task, retain its ID and original outcome as the
parent record. Assign new child IDs and record their parent and coverage of that
outcome; do not silently narrow or rename the original task. Mark the parent
`done` only when required children and its original acceptance are verified.
This lineage is useful for an existing oversized task, not a mandatory hierarchy
for every new task.
Only outcomes required by the original approved scope are required children.
Keep optional future operations separate: a readiness-only parent must not depend
on an unrequested deployment or acquire it as a completion requirement.

Use repository issue keys as the primary IDs where that is already the convention;
map any Council alias in the authoritative plan instead of creating a second list.
Do not embed project plan markers in production source or test comments. Commit/PR
bodies and the project's plan/evidence records may reference them.

## Types, priorities and statuses

Use lowercase machine-readable values. Type describes the deliverable, priority
describes urgency, status describes progress, and optional tags describe the
domain (`frontend`, `backend`, `security`, language, repository). A domain, agent
name or severity is not a task type. Use one primary type per task:

| Type | Deliverable |
| --- | --- |
| `investigation` | Evidence, root cause or a bounded recommendation resolving an unknown |
| `design` | A decision or contract needed before implementation |
| `implementation` | Working code, configuration, wiring, bug fix or refactor with its checks |
| `verification` | Independent review, test result, simulation or integration evidence |
| `documentation` | Accurate guidance or another requested written artifact |
| `operations` | An authorized installation, migration, deployment or operational action |

Choose the type from the task's immediate deliverable, not a future activity it
discusses. Assessing deployment readiness is `verification`; writing a rollout
runbook is `documentation`. Neither becomes `operations` merely by mentioning
deployment, and neither implies authorization to deploy.

Use the repository's priority definitions. If absent, use `P0` for an immediate
critical incident, `P1` for a serious correctness/security or delivery blocker,
`P2` for normal planned work, and `P3` for lower urgency improvements. Risk and
dependency order remain separate: a low priority prerequisite can run first.

Canonical statuses are `pending`, `in_progress`, `blocked`, `done`, `deferred`
and `cancelled`. `blocked` names the unavailable prerequisite and recovery action;
it does not mean merely difficult. `deferred` records the reason and agreed
scope decision or follow-up trigger. `cancelled` records why the outcome is no
longer needed. Neither counts as delivered. Required work cannot be silently
deferred or cancelled to make the plan look complete.

Map existing tracker values explicitly rather than rewriting its native schema:
`todo`/`open` → `pending`, `doing` → `in_progress`, `completed`/`closed` → `done`
only when closure means verified delivery. Claude/Codex trackers offering only
`pending`, `in_progress`, `completed` use `completed` for verified `done`; keep
blocked/deferred/cancelled reasons in the plan and tracker description. If no
native tracker is available, update the plan directly and say so accurately.

## Minimum task record

Use a short row plus a context capsule for substantive tasks. Omit empty optional
fields; do not repeat global rules or shared context in every record.

```markdown
- [ ] P12.TASK.3 — Reject a duplicate event before charging
  - Type: implementation; Priority: P1; Status: pending; Owner: main session
  - Scope: API repository, src/webhooks.ts and tests/webhooks.test.ts;
    preserve the event-v1 response contract used by the worker.
  - Context: retry can arrive after a successful charge; use the unique event key.
    Inputs: plan decision "Event identity" and the sanitized retry fixture.
  - Depends on: P12.TASK.2. Preconditions: event key contract resolved.
  - Acceptance: retry produces one charge and the same outcome; a failed first
    attempt can recover; existing v1 callers still pass compatibility checks.
  - Verify: run the repository webhook regression command from the API worktree;
    expect exit 0 and the duplicate/failure/v1 cases to pass. Record exact command
    once confirmed, result and evidence path before marking done.
  - Delivery: batch with the worker contract change; no push authorized.
```

The record must locate the relevant repository/worktree, own a bounded surface,
explain the invariant or reason, name required inputs and dependency IDs, and
define observable acceptance and verification. Give exact commands when known;
otherwise name how to discover the repository check rather than fabricate it.
Investigation tasks specify a bounded search and decision/evidence output. An
operations task names the target environment, existing authorization, readiness
and rollback conditions. Shared commit policy belongs in plan context; repeat a
delivery boundary only when a task needs a special atomic batch or permission.

## Ready, execute, verified

A task is ready when its required inputs are located, decisions and dependencies
are resolved, permissions cover its effects, and its acceptance check is concrete.
If its worktree, owner or required contract is unknown, the next action is a
bounded lookup or assignment, not an implementation command. A proposed command
does not establish that its working directory or prerequisites exist.
For a planning-only draft, retain recorded statuses and label proposed IDs, checks
and dependencies as proposals. Decomposing a pending task does not start it.
The current handoff delivers the draft; describe implementation commands as future
steps within the user's authorization, not actions to execute under a plan-only request.
Choose a ready task by priority and dependency order. Keep the live tracker to the
active task and a few ready next tasks, linked by ID to the complete plan. Do not
copy a hundred-task backlog into every turn or replace task tracking with phase
names. Tasks that modify shared files or dependent contracts need coordination;
different dependency IDs alone do not make them safe to execute in parallel.

Before editing, inspect current files and other agents' work. Execute within the
task's scope, preserve their changes, and add newly discovered work to the same
plan with new IDs. Resolve necessary in-scope work; surface a material scope
change for the user's decision without dropping it or expanding permissions.

Mark `done` only after acceptance checks finish successfully and evidence is
recorded. A command starting, a file existing or a search match does not prove
behavior. Record failures, skipped checks and what they leave unverified. Link
valid evidence for unchanged inputs instead of rerunning checks after every
compaction. Track implementation, local testing, integration, installation and
deployment separately; a completed local fix does not imply deployment.

## Resume without losing the thread

Keep one compact current-handoff section in the existing plan. Update it at a
meaningful milestone or before yielding/compaction, replacing stale current state.
It contains the goal and accepted constraints; active task ID/status; repository,
worktree/branch and commit or uncommitted changes; key decision/input links;
completed verification evidence and remaining checks; blockers; and the next
specific action. If a task is partially done, name the exact remaining step.

Give a delegated agent only this relevant capsule, its owned paths and permitted
effects, dependency/contract excerpts, required evidence and output bound. Refer
to task IDs in its result; keep long logs in linked artifacts. The main owner
integrates the result into the same plan. Do not create a helper plan or assume a
summary proves a test passed. On resume read the handoff and active task first,
then only inputs needed for the next action; confirm worktree changes before edits.

## Plan quality check

- Every requested outcome maps to a task and acceptance check, including integration.
- Titles describe outcomes; oversized or decision-dependent tasks are split.
- IDs are unique and stable; types, priorities, statuses and domain tags are distinct.
- Dependencies exist, form no cycles, and allow at least one executable next step
  or clearly explain an external blocker.
- Owned paths, inputs and verification are sufficient for an agent without the chat.
- Partial work, unverified claims and external effects are visible in the handoff.
- Required children preserve the approved parent scope; optional future operations
  do not create new completion requirements or authorization.

Related guidance: [execution progress](plan-execution-progress.md),
[one plan](../../rules/common/one-plan-per-workspace.md),
[completion](../../rules/common/done-criteria.md) and
[agent handoffs](../../skills/council-rules/references/agent-delegation.md).
