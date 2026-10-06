---
name: cost-aware-llm-pipeline
description: Cost optimization patterns for LLM API usage — model routing by task complexity, budget tracking, retry logic, and prompt caching.
disable-model-invocation: true
---

# Cost-Aware LLM Pipeline

> **Size budget: 8 KB** — `token-budget.mjs --check`.

Cost optimization patterns for LLM API usage — model routing by task complexity, budget tracking, retry logic, and prompt caching.

## Working procedure

1. Establish the relevant mode and existing evidence; do not repeat completed intake.
2. Measure quality, latency and cost together on representative inputs. Verify current prices from primary providers before financial claims. Bound retries and preserve critical validation even when selecting cheaper models.
3. Read only the corresponding sections below before applying their examples.
4. Verify the result with meaningful positive, negative and failure controls. Record actual outcomes, limitations and next action.

## Selected references

- [When to Activate](references/procedure.md#when-to-activate) — read when this part of the task applies.
- [Core Concepts](references/procedure.md#core-concepts) — read when this part of the task applies.
- [Composition](references/procedure.md#composition) — read when this part of the task applies.
- [Pricing Reference (2025-2026)](references/procedure.md#pricing-reference-2025-2026) — read when this part of the task applies.
- [Best Practices](references/procedure.md#best-practices) — read when this part of the task applies.
- [Anti-Patterns to Avoid](references/procedure.md#anti-patterns-to-avoid) — read when this part of the task applies.
- [When to Use](references/procedure.md#when-to-use) — read when this part of the task applies.
- [Regex-first parsing for structured text](references/procedure.md#regex-first-parsing-for-structured-text) — read when this part of the task applies.
- [Purpose](references/procedure.md#purpose) — read when this part of the task applies.
- [When NOT to use](references/procedure.md#when-not-to-use) — read when this part of the task applies.
- [Standards Cited](references/procedure.md#standards-cited) — read when this part of the task applies.
- [Anti-Patterns](references/procedure.md#anti-patterns) — read when this part of the task applies.
- [Verification Checklist](references/procedure.md#verification-checklist) — read when this part of the task applies.
- [Cross-References](references/procedure.md#cross-references) — read when this part of the task applies.

The [full procedure](references/procedure.md) preserves detailed examples and standards.
Load relevant excerpts rather than the entire reference. Runtime capabilities and higher-priority instructions govern imported templates.
