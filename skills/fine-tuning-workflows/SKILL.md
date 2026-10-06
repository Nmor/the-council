---
name: fine-tuning-workflows
description: Principal-level fine-tuning lifecycle — when fine-tuning beats prompting + RAG, dataset curation, instruction tuning vs preference optimisation (SFT / DPO / RLHF), parameter-efficient methods (LoRA / QLoRA / adapters), evaluation, safety re-tuning, deployment, monitoring, and the cost / benefit framework for choosing between fine-tuning, RAG, and base-model usage.
disable-model-invocation: true
---

# Fine-Tuning Workflows

> **Size budget: 8 KB** — `token-budget.mjs --check`.

Principal-level fine-tuning lifecycle — when fine-tuning beats prompting + RAG, dataset curation, instruction tuning vs preference optimisation (SFT / DPO / RLHF), parameter-efficient methods (LoRA / QLoRA / adapters), evaluation, safety re-tuning, deployment, monitoring, and the cost / benefit framework for choosing between fine-tuning, RAG, and base-model usage.

## Working procedure

1. Establish the relevant mode and existing evidence; do not repeat completed intake.
2. Confirm dataset rights, provenance and privacy; compare held-out evaluation to a baseline before promotion. Record model/data versions, rollback and reload evidence. A training job starting is not a successful promotion.
3. Read only the corresponding sections below before applying their examples.
4. Verify the result with meaningful positive, negative and failure controls. Record actual outcomes, limitations and next action.

## Selected references

- [Purpose](references/procedure.md#purpose) — read when this part of the task applies.
- [Standards Cited](references/procedure.md#standards-cited) — read when this part of the task applies.
- [When to Fire](references/procedure.md#when-to-fire) — read when this part of the task applies.
- [Core Patterns](references/procedure.md#core-patterns) — read when this part of the task applies.
- [Anti-Patterns](references/procedure.md#anti-patterns) — read when this part of the task applies.
- [Verification Checklist](references/procedure.md#verification-checklist) — read when this part of the task applies.
- [Cross-References](references/procedure.md#cross-references) — read when this part of the task applies.
- [Why This Skill Exists](references/procedure.md#why-this-skill-exists) — read when this part of the task applies.
- [Learning hooks](references/procedure.md#learning-hooks) — read when this part of the task applies.

The [full procedure](references/procedure.md) preserves detailed examples and standards.
Load relevant excerpts rather than the entire reference. Runtime capabilities and higher-priority instructions govern imported templates.
