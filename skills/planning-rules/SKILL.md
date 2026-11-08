---
name: planning-rules
description: Author, refine and resume actionable plans with stable task labels, types, dependencies and bounded handoffs; route relevant verification, ADR, runbook and delivery guidance for Claude Code and Codex.
disable-model-invocation: true
---

# planning-rules

> **Size budget: 25 KB.** Check: wc -c. Gate: node ~/.claude/scripts/token-budget.mjs --check
>

## Purpose

Use the existing authoritative project plan. For task decomposition, labels/types,
dependencies, acceptance and context preservation, read the shared task contract
in the first row. Other rows are conditional; load only relevant guidance. A routine
fix needs no exhaustive questionnaire, fixed task count or new plan. This router
serves both Claude Code and Codex; it does not claim automatic path activation.

## Standards Cited

The documentation formats the migrated rules build on; detail lives in the references.

- **Nygard, "Documenting Architecture Decisions" (2011)**: the ADR format (`references/adr-template.md`)
- **MADR (Markdown Any Decision Records)**: the ADR structure these templates stay compatible with
- **C4 Model** (Simon Brown): context, container, component and code views
- **arc42**: the architecture-documentation template the ADR rule cross-references

## Routing table

| Topic | When you need it | Reference |
| --- | --- | --- |
| **Principal quality** | Substantive requirements, invariants, design/tool decisions, executable wiring, consumer compatibility and meaningful failure evidence. | [Quality contract](../../rules-library/council-detail/principal-level-mandate.md) |
| **Actionable tasks** | Authoring, reviewing or resuming substantive planned work: one outcome, stable IDs, canonical types/priorities/statuses, bounded scope/context, dependencies and verification. | [Shared task contract](../../rules-library/council-detail/plan-task-breakdown.md) |
| **Execution and handoff** | Updating partial/completed work or resuming after interruption: small active tracker window and one compact current handoff in the existing plan. | [Execution progress](../../rules-library/council-detail/plan-execution-progress.md) |
| **Code-graph validation** | Any task, todo, commit, phase or completion claim that touches code, config or wiring. Incremental per-task checks, the per-surface + per-language command matrices, phase-boundary sweep, pre-push full-graph gate, `BUG(unwired-…)` discipline. | [`references/code-graph-validation.md`](references/code-graph-validation.md) |
| **ADR template** | Recording a non-trivial architectural decision before the implementation lands. What counts as architectural, the MADR-compatible structure, numbering / immutability / supersede rules, standards cited. | [`references/adr-template.md`](references/adr-template.md) |
| **Runbook template** | Introducing an alert, a failure mode or an error code. The required entry structure (What you'll see → Diagnose → Fix → Verify → Communicate), the eight hard rules, the canonical incident classes. | [`references/runbook-template.md`](references/runbook-template.md) |
| **Plan completion before push** | Any `git push`, `git push --tags`, or `gh pr create` during plan execution. Commit policy per plan, the push gate, the narrow bug-fix exception, branch protection, the AI-attribution trailer ban, the canonical push flow. | [`references/plan-completion-before-push.md`](references/plan-completion-before-push.md) |

## Source files migrated

- `rules-library/common/code-graph-validation.md`
- `rules-library/common/adr-template.md`
- `rules-library/common/runbook-template.md`
