---
name: prompt-improver
description: "Transforms vague or under-specified prompts into actionable, research-grounded requests through systematic codebase + workspace + open-source + online research. Wires the user's directive flow into the Council Protocol Phase 0 and the global task-intake-due-diligence.md questionnaire. Invoked by the UserPromptSubmit hook when a prompt lacks specificity OR when a clear-but-significant prompt needs the full intake before execution."
disable-model-invocation: true
---

# Prompt Improver Skill

> Sister to: `~/.claude/rules/common/task-intake-due-diligence.md`
> (the 29-question intake), `~/.claude/rules-library/common/reuse-first.md`
> (Q1 sweep), `~/.claude/rules/common/official-docs-first.md` (Q3
>
> - Q29), the Council Protocol Phase 0 in `~/.claude/CLAUDE.md`,
> `~/.claude/rules/common/plan-task-breakdown.md` (Q27 output),
> `~/.claude/rules/common/plan-execution-progress.md` (intake is
> the first progress update). The hook lives at
> `~/.claude/hooks/improve-prompt.py`.
>
> **Size budget: 22 KB** — `token-budget.mjs --check`.

## Purpose

Two responsibilities:

1. **Clarification** — when a prompt is vague (missing target,
   missing context, missing success criteria), research the
   project + ecosystem first, then ask 1-6 grounded questions to
   close the gap.

2. **Intake** — when a prompt is CLEAR but non-trivial (any
   feature, refactor, integration, plan), run the
   `task-intake-due-diligence.md` questionnaire to surface
   prior art, OSS alternatives, scalability, integration shape,
   and the cross-cutting concerns BEFORE any code is touched.

Both responsibilities run BEFORE the Council convenes. The
output of this skill is the substrate Council Phase 0 reads.

## When this skill activates

The UserPromptSubmit hook (`~/.claude/hooks/improve-prompt.py`)
evaluates every incoming prompt and routes it:

| Prompt shape | Routing |
| --- | --- |
| `*` prefix | Hook strips `*` and bypasses this skill (user opt-out) |
| `/` prefix (slash command) | Passes through unchanged |
| `#` prefix (memorize) | Passes through unchanged |
| Vague (no target, no action, no success criteria) | THIS SKILL: Clarification mode (research → 1-6 questions) |
| Clear + trivial (typo, single-line edit, config tweak) | Hook passes through; abbreviated intake (Q1 + Q2 + Q27 only) |
| Clear + non-trivial (feature, refactor, integration, plan) | THIS SKILL: Intake mode — proportionate: only the questions that bear on THIS task (task-intake-due-diligence forbids printing all 29 per feature) |

The hook trusts user intent by default. When in doubt, it
errs toward "let the skill ask" rather than "guess."

## Mode 1: Clarification (the prompt is vague)

A vague prompt is one where ANY of these is missing:

- **Target**: which file / module / feature / bug / area
- **Action**: what to do (fix / build / refactor / investigate /
  document)
- **Success criteria**: how the user will know the work is done

Examples of vague prompts that need clarification:

- "fix the bug"
- "make it faster"
- "add tests"
- "clean up that thing"
- "look at this"

### Phase 1 (Clarification): Research

Before asking any question, do the research. Skipping research
produces generic options that don't help the user — the goal is
options grounded in actual codebase + workspace + ecosystem
findings.

Research radius (in order — exhaust each before reaching the
next, per `reuse-first.md` rule 7):

1. **Conversation history** — what was just discussed; what
   the user was working on; what errors / files were mentioned.
2. **Codebase sweep** — `grep` / `glob` / Explore agent for
   the concept. Check `components/`, `lib/`, `services/`,
   `pkg/`, `utils/` per language.
3. **Workspace `.claude/` rules + memory** — project-specific
   conventions that frame the answer.
4. **Recent git history** — `git log --since="1 month ago"` +
   `git status` for current state.
5. **Failing tests / lint warnings / IDE diagnostics** — the
   bug being asked about may already be visible.
6. **`docs/`, `README`, `CHANGELOG`, runbook** — what the
   project already says about itself.
7. **Open-source + online** — when ambiguity persists, search
   GitHub / package registries / RFCs / vendor docs.

Document findings briefly. Each finding maps to an option in
the next phase.

### Phase 2 (Clarification): Generate questions

Based on research, formulate 1-6 questions. Each question:

- **Grounded** — every option comes from a research finding,
  not from imagination.
- **Specific** — "Login auth failure in `auth.py:145`" beats
  "an authentication issue."
- **Multiple-choice** — 2-4 concrete options per question;
  AskUserQuestion auto-adds "Other."
- **Focused** — one decision point per question; never
  combine "which file?" with "which approach?" in one question.
- **Trade-off-aware** — options carry brief descriptions of
  consequences.

Question count:

- **1-2 questions** — simple ambiguity (which file, which
  approach)
- **3-4 questions** — moderate complexity (scope + approach
  - validation)
- **5-6 questions** — complex (major feature with multiple
  decision points)

If research is sufficient to infer the user's intent with high
confidence, skip questions and proceed directly. Trust user
intent.

### Phase 3 (Clarification): Ask via AskUserQuestion

Present the questions using `AskUserQuestion`:

```yaml
- question: "Which bug are you referring to?"
  header: "Bug target"  # max 12 chars
  multiSelect: false
  options:
    - label: "Login auth failure"
      description: "auth.py:145 swallows exceptions; tests failing in test_auth.py"
    - label: "Session timeout"
      description: "session.py:89 has hardcoded 30s timeout; users report logouts"
    - label: "Other (specify)"
      description: "Different issue I'll describe"
```

For options requiring side-by-side comparison (UI mockups,
code snippets, diagram variations), add a `preview` field per
option (rendered as monospace block — single-select only).

### Phase 4 (Clarification): Execute

After the user answers, proceed with:

- The original intent
- The clarification answers
- The research findings
- The conversation history

If the clarified prompt is now non-trivial (feature, refactor,
integration), CHAIN into Mode 2 (Intake) before any code.

## Mode 2: Intake (the prompt is clear but non-trivial)

When the prompt is unambiguous AND the work is non-trivial,
this skill runs the full `task-intake-due-diligence.md` Q1-Q29
questionnaire BEFORE any implementation discussion. The output
populates Council Protocol Phase 0.

### Phase 1 (Intake): Codebase + workspace research

Same as Clarification Phase 1, with broader scope. The intake
answers Q1 ("Has it been done before? — in this codebase / in
sister workspaces") via this research.

### Phase 2 (Intake): External research

For Q3 (canonical reference), Q4 (OSS option), Q5 (SOTA scan),
Q24 (AI/ML ethics when applicable), Q25 (vendor/IP/license),
do online research:

- **WebSearch** for SOTA scans, recent papers, RFC drafts.
- **WebFetch** for primary-source vendor docs (per
  `official-docs-first.md`).
- **GitHub search** for prior implementations.
- **Package registries** (npm, PyPI, crates.io, Maven Central,
  RubyGems, Go pkg) for OSS candidates.
- **Standards bodies** (W3C, IETF, ISO, NIST, OWASP) for
  authoritative specs.

Document each consulted source in the intake's Q29 table
(URL + read date + key finding).

### Phase 3 (Intake): Fill the questionnaire

Walk Q1-Q28 from `task-intake-due-diligence.md`. For each
question, produce a short answer with the relevant findings.
For questions that are N/A for this task, mark explicitly and
state why in one line.

The output is the intake block — a table or per-question
section that becomes Phase 0 of the Council discussion (or
the Context section of a plan file under
`~/.claude/plans/<slug>.md` or `<project>/.claude/plans/`).

### Phase 4 (Intake): Propose plan or chain to Council

After the intake:

- **Small task** (atomic, ≤ 4h work): proceed to
  implementation with the intake as Council Phase 0.
- **Medium task** (multi-file, 4-40h): create or update a
  plan file per `plan-task-breakdown.md` (long list of small
  atomic tasks) and run Council Phase 0-2.
- **Large task** (multi-phase, 40+ h): create a multi-phase
  plan file and route through ExitPlanMode for user approval
  before any code.

## Output expectation

After this skill runs (in either mode), the assistant's response
to the user includes:

1. **If Clarification mode**: the AskUserQuestion call with
   research-grounded options. The skill pauses for the user's
   answer.
2. **If Intake mode**: the intake block (Q1-Q29 summary table
   or per-question subsections), then either:
   - The Council Phase 0 output (proceeding to Phase 1-3), OR
   - The plan file path that captures the intake + action
     plan, OR
   - The ExitPlanMode call for user approval.

The intake block is durable — it lives in the plan file (or
the Council Phase 0 output) and is not redone for the same
task across sessions.

## Anti-Patterns

| Pattern | Why bad | Correct alternative |
| --- | --- | --- |
| Ask 10 clarifying questions for every prompt | User abandons; loses trust | Cap at 3-6; only when truly ambiguous |
| Treat every prompt as "clear, no questions needed" | Implements wrong thing; wastes work | Lower the bar to ask when ambiguity surfaces |
| Generate clarifying questions before reading the codebase | Questions are uninformed; user has to re-explain context | Phase 1 research first; Phase 2 questions grounded in findings |
| Ask the same clarifying question twice in different forms | User feels not-listened-to | Track asked dimensions; vary across runs |
| Skip prompt-improver for `*`-prefixed prompts but ALSO skip Council | `*` is clarification-bypass, NOT Council-bypass | Council still convenes |
| Hard-coded questions regardless of project context | Generic / unhelpful | Research-grounded; per Phase 0 task intake |
| Present questions without recommended defaults | User has to think harder than necessary | Suggest a default for each; user accepts or overrides |
| Lose the original prompt content after clarification | Information lost in transit | Carry forward the enriched prompt verbatim |

## Cross-References

- `~/.claude/CLAUDE.md` — Council protocol the prompt-improver feeds into
- `~/.claude/hooks/improve-prompt.py` — UserPromptSubmit hook entry
- `~/.claude/rules/common/task-intake-due-diligence.md` — 29-question intake the improver
  pre-populates
- `~/.claude/rules/common/council-default.md` — Council convenes regardless of clarification
- `iterative-retrieval` skill — phase-1 codebase research uses this pattern
- `search-first` skill — also engaged during prompt research

## Learning hooks

Per `~/.claude/rules/common/continuous-learning-mandate.md`:

**Signals to watch**:

- Vague prompt slipped past the hook and reached implementation without clarification (router
  heuristic gap)
- Clear-but-non-trivial prompt skipped Mode 2 intake (rule weakening — sister
  `task-intake-due-diligence.md`)
- Generic option offered to user instead of research-grounded option (anti-pattern 1 recurrence)
- Question fabricated when research surfaced zero real options (anti-pattern 6)
- Re-asked context already provided in conversation history (anti-pattern 3 — trust history)
- "Just do it" override accepted without abbreviated intake (anti-pattern 7 — sister
  `proper-fixes-first.md`)
- More than 6 questions issued in a single AskUserQuestion (rule cap exceeded — should stage or
  convert to ExitPlanMode)
- Intake Q29 (online sources) empty on an external-integration task (sister `official-docs-first.md`
  violation)
- Trivial-mode used for a task that touched user-visible behaviour / security / data shape (router
  miscategorisation)

**Refinement candidates**:

- New row in the routing table when a recurring prompt shape doesn't fit current modes
- New anti-pattern entry when a question-style failure recurs across 2+ sessions
- Tightening of the trivial-mode definition when "small" prompts later prove non-trivial
- New research-radius row (per Phase 1 Clarification) when a new source class (e.g., partner-portal
  docs, internal RFC archive) becomes load-bearing
- Promotion of an inline citation pattern to a dedicated "Standards Cited" subsection when a
  regulatory / RFC anchor recurs across intakes

## Supporting references

Use [research strategies](references/research-strategies.md) to choose evidence
and [question patterns](references/question-patterns.md) for missing constraints.

The [OpenAI prompt-engineering guide](https://developers.openai.com/api/docs/guides/prompt-engineering)
supports clear instructions and relevant context. Council intake and escalation
steps remain local workflow choices.
