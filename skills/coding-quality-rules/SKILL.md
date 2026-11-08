---
name: coding-quality-rules
description: Apply cross-language engineering quality requirements when implementing or reviewing code. Covers root-cause fixes, complete wiring, error handling, strict diagnostics and meaningful verification; use language guidance for language-specific details.
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
  - "**/*.mjs"
  - "**/*.cjs"
  - "**/*.mts"
  - "**/*.cts"
  - "**/*.py"
  - "**/*.pyi"
  - "**/*.go"
  - "**/*.rb"
  - "**/*.rake"
  - "**/*.rs"
  - "**/*.java"
  - "**/*.kt"
  - "**/*.kts"
  - "**/*.swift"
  - "**/*.dart"
  - "**/*.cs"
  - "**/*.c"
  - "**/*.cpp"
  - "**/*.cc"
  - "**/*.cxx"
  - "**/*.h"
  - "**/*.hpp"
  - "**/*.lua"
  - "**/*.sh"
  - "**/*.bash"
  - "**/*.sql"
  - "**/*.vue"
  - "**/*.svelte"
disable-model-invocation: true
---

# Coding quality

> **Size budget: 24 KB** — `token-budget.mjs --check`.

Select this guidance explicitly through Council routing when implementing or reviewing
code. Source `paths:` metadata is not proof of automatic activation in either runtime.
Read common coding style and applicable language guidance before edits; load only
the references relevant to the change. Existing invocation policy is preserved.

## Required outcomes

Use the [principal quality contract](../../rules-library/council-detail/principal-level-mandate.md)
for substantive decisions, complete functionality, tool fitness and evidence. Inspect
existing work and preserve the authoritative plan, user scope and other agents' edits.

- Fix the cause and prove the requested behavior. Do not bypass authorization, mask
  failures, disable required functionality or weaken checks to make a result green.
- Trace affected entry points, registration/configuration, dependencies and consumers.
  Test the executable path; an implemented helper or passing mock does not prove wiring.
- Handle every return value and error, including in tests. Preserve useful causes,
  stable errors and observable failure. Verify relevant partial/ambiguous effects,
  retries, concurrency, cancellation and durable state. Go's `for _, value := range`
  is valid; it does not discard a return value or error.
- Preserve consumer contracts and rollout order. Prefer cohesive existing primitives
  and explicit dependencies. Do not add new abstractions just to satisfy a template.
- Follow strict repository lint, type and testing gates. Read assertions and select
  realistic integration/fault checks; coverage counts alone are insufficient.
- Comments explain intent/invariants and public docs explain consumer behavior.
  PRs describe the final change, its reason and verification tied to reviewed inputs.

## Review and verification

Use the [review baseline](../../rules-library/common/git-workflow.md#review-baseline)
for workspace or PR reviews, including relevant untracked work and actual patches.
Inspect changed code and affected consumers for defects caused or exposed by the
change. Repair in-scope defects; record unrelated debt separately. Do not turn every
file read into another whole-file or whole-repository audit.

Search/regex results are discovery signals, not semantic verdicts. Confirm a match
with source context, the relevant language semantics and configured diagnostics.
Do not refactor valid value iteration, independent literals or safe ownership merely
because a broad pattern matched. Resolve real violations without suppressions or
weakening the gate. Preserve meaningful repository thresholds and required tests.

Verify changed inputs, reuse still-valid evidence for unchanged inputs, and broaden
checks only for a new change, failure or unresolved concern. Keep verbose logs outside
active context. Separate implemented, tested, installed and runtime-verified claims;
record failed/skipped/unavailable required checks and their next action. A hook is
not evidence that the code passed strict lint or that a feature is wired.

## Reference routing

| Reference | Read when |
| --- | --- |
| [Coding style](references/coding-style.md) | Naming, comments, ownership, boundaries and common error handling |
| [Common patterns](references/common-patterns.md) | Selecting existing architecture and response patterns |
| [Reuse-first](references/reuse-first-rule.md) | A proposed component may duplicate an existing primitive |
| [Proper fixes](references/proper-fixes-first-rule.md) | Diagnosing a defect or considering containment |
| [No silent drops](references/no-silent-drops-rule.md) | Removing or replacing required functionality |
| [No silent failures](references/no-silent-failures-rule.md) | Failure reporting and downstream effects |
| [No discards](references/no-discards-rule.md) | Return values and error ownership, including tests |
| [No ambient globals](references/no-ambient-globals-rule.md) | Dependency/state ownership and testability |
| [No local filesystem state](references/no-local-filesystem-rule.md) | Durable state on ephemeral platforms |
| [Error codes](references/error-codes-rule.md) | Stable machine-readable error contracts |
| [Error context](references/error-handling-with-context.md) | Diagnosable causes and operation identifiers |
| [Log levels](references/log-levels-rule.md) | Signal severity and operational logging |
| [Versioning](references/semantic-versioning-rule.md) | Public compatibility and release semantics |
| [Strict lint](references/extreme-lint-policy.md) | Applicable analyzer setup, thresholds and diagnostics |
| [Framework support](references/always-updated-frameworks-rule.md) | Dependency support and update decisions |
| [Model/runtime guidance](references/performance-model-selection.md) | Supported models, tools and bounded context |
| [Testing](references/testing-requirements.md) | Regression, fault, integration and coverage evidence |
| [Local testability](references/local-testability-rule.md) | Reproducing behavior before implementation |
| [Development setup](references/local-dev-setup-rule.md) | Repeatable environment and secret provisioning |

Each reference remains available on demand. If it conflicts with the current shared
contract, repair the specific conflict rather than executing obsolete automatic
triggers, fixed agent fan-out or platform-specific hooks in another runtime.
