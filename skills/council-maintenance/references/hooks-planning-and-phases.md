# council-maintenance: Hooks planning and phases

> Learning hooks for the plan-authoring, plan-execution and phase-closeout rules. Pointed at by the
> `## Per-rule learning hooks` routing table in `../SKILL.md`.
>
> **Size budget: 9 KB** — `token-budget.mjs --check`.

## `competitive-parity-per-phase.md`

Per `~/.claude/rules/common/continuous-learning-mandate.md`:

**Signals to watch**:

- Phase / wave closed without the Step 6 parity output block (rule 1 +
  rule 2 violation)
- Reference competitor set unchanged for > 12 months (rule 8 signal)
- New feature dimension shipped without a discovery filter in the
  same wave (Discovery-parity rider violation)
- Parity backlog rows without a next-wave target (rule 7 violation)
- Press-summary citation used as sole source (rule 5 violation)
- Solo phase that touched user-visible surface skipped Step 6 as
  "abbreviated" (rule 9 weakening)

**Refinement candidates**:

- New reference-competitor row when a material new entrant emerges
- New Discovery-parity rider row when a feature class ships without
  a matching filter surface
- Tightening the cadence when a wave's parity gap re-opens because
  the scan didn't catch a competitor's shipment
- Promotion to a mechanical hook when the "did the wave-close block
  include Step 6?" check can be automated (grep the plan file for
  "Competitive parity (this")

## `plan-completion-before-push.md`

Per `~/.claude/rules/common/continuous-learning-mandate.md`:

**Signals to watch**:

- `git push` executed while plan phases still pending (rule 2 violation — push gate weakening)
- Active plan does not declare `commit-policy` in its Context (rule 1 violation — implicit policy
  drift)
- "Push" inferred from ambiguous user language ("ship", "ready", "looks good") without explicit
  confirmation (rule 10 weakening)
- Bug-fix exception claimed without an actual live-failure / explicit-override pair (rule 3 misuse)
- Multi-repo push approval reused across repos without per-repo confirmation (rule 7 weakening)
- `git push --tags` or PR creation done mid-plan without explicit per-action authorization (rules
  8 + 9 weakening)
- Verification block missing or stale at push time (rule 6 violation — claim without proof)
- `--no-verify` / `--no-gpg-sign` used to bypass hooks (rule 5 violation)

**Refinement candidates**:

- New row in the "exception" rule when a recurring time-pressure class (security incident, regulator
  deadline) emerges with documented user-side authorization shape
- Tightening of the ambiguous-language list when a new phrase ("let's go", "all good") proves to
  silently authorize pushes
- New cross-reference when a sister rule (no-overclaim, verify-before-claim, no-silent-drops)
  provides a pre-push gate
- New row in the push-decision response shape when multi-repo / multi-branch / multi-tag pushes
  recur

## `plan-execution-progress.md`

Per `~/.claude/rules/common/continuous-learning-mandate.md`:

**Signals to watch**:

- Current handoff omits active task ID/status, remaining partial work or next exact action
- A started/failed/skipped check is recorded as successful evidence
- A resume reloads the entire history rather than the handoff, active task and needed inputs
- A native tracker state is treated as delivered without acceptance evidence
- A blocker lacks the unavailable prerequisite and recovery action
- Required work disappears when tasks are reordered, deferred or cancelled
- Installed/deployed claims are inferred from local implementation or unit tests

**Refinement candidates**:

- Refine the shared handoff only for context repeatedly missing in actual resumes
- Improve tracker mappings when a runtime has different supported states
- Link existing evidence instead of adding repeated status narratives

## `plan-task-breakdown.md`

Per `~/.claude/rules/common/continuous-learning-mandate.md`:

**Signals to watch**:

- Phase-level tasks combine independent outcomes or unresolved design decisions
- Task IDs change across handoffs, trackers or phase moves
- Types are confused with priorities, domains or specialist names
- Owned paths, input decisions, dependencies or acceptance evidence are missing
- Dependency links are missing/cyclic or owners overlap without coordination
- A change is separated from tests needed for a safe deliverable
- Full backlog duplication causes context growth, or new work is absent from the plan
- Speculative task counts, duration quotas or compulsory cleanup inflate a simple plan

**Refinement candidates**:

- Refine outcome boundaries using actual stalled or incomplete task evidence
- Keep schema changes in the canonical task contract and route consumers to it
- Exercise cross-repository dependencies, legacy IDs and partial-work resumes

## `post-phase-retrospective-review.md`

Per `continuous-learning-mandate.md`:

**Signals to watch**:

- Phase closeout without the five-step sweep block (Rule 1 violation)
- Step 2 re-used the same gate as the prior phase's verification (Rule 2 violation)
- Step 3 (wiring) skipped on a phase touching cross-repo seams (Rule 4 weakening)
- Step 4 reported "PASS" without naming the layer each prior gate did NOT exercise
  (Rules 6 + 8 principal-floor weakening)
- Step 5 follow-up absorbed into "I'll handle it later" without a durable record
  (`no-silent-drops.md` violation)
- User reports a regression the prior phase's gates "passed" (Rule 3 weakening)
- Multi-PR stream with no accumulated retrospective map (Rule 11 weakening)
- Same miss class across 3+ phases without an automated check added (Rule 10)
- User-visible fix marked "done" before user confirms (Rule 9 weakening)
- Council Phase 2 re-check skipped on a materially-touched prior phase (Rule 7)
- Durable phase-review artefact not written (Rule 12 violation)
- STOP-THE-LINE signal proceeded past silently (escalation weakening)

**Refinement candidates**:

- New gate-roster row when a new artifact class needs a retrospective gate
- New recurring-miss-class entry when 3+ phases hit the same class without a check
- Tightening of the "different-angle gate" requirement when same-gate retros recur
- New STOP-THE-LINE signal when a recurring escalation condition surfaces
- New cross-reference when a sister rule provides a gate the sweep depends on
