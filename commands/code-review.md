---
name: code-review
description: Review workspace, commit or PR changes for correctness, security, functionality and quality against the actual diff and affected consumers.
command: true
---

# Code review

> **Size budget: 8 KB** — `token-budget.mjs --check`.

Use the [code-reviewer procedure](../agents/code-reviewer.md) and the language reviewer for
the stack the diff touches — `go-reviewer`, `typescript-reviewer` (TS/JS/Vue/Svelte),
`python-reviewer`, `ruby-reviewer`, `php-reviewer`, `java-reviewer` (Java/Kotlin),
`rust-reviewer`, `dotnet-reviewer` (C#), `mobile-reviewer` (Swift/Dart/RN). Every stack has
one; a review that skips it is a cross-cutting review reported as a complete one. `/go-review`
and `/python-review` are deeper dedicated flows for those two; the rest run through here. Follow the [principal quality contract](../rules-library/council-detail/principal-level-mandate.md)
for substantive changes; do not invent findings or expand a focused review without
a concrete reason.

1. Establish the [review baseline](../rules-library/common/git-workflow.md#review-baseline).
   Workspace review includes staged, unstaged and relevant untracked files. PR review
   uses the actual target divergence diff and commit patches. A clean worktree or
   commit list is not an empty review. Record missing context honestly.
2. Read affected contracts and consumers. Trace public entry points, registration,
   configuration, implementation and effects. Check relevant authorization, data/money
   integrity, partial failure, retries, concurrency, cancellation and compatibility.
3. Inspect assertions and appropriate fault/integration evidence, as well as strict
   diagnostics and coverage. Confirm comments explain intent and PR docs match final
   behavior with verification tied to the reviewed inputs. Do not confuse a green
   mocked path with complete functionality.
4. Report concrete findings with location, trigger, failure mode, evidence and remedy.
   Assign severity by impact, likelihood and project requirements; category, line
   count or comment presence alone does not determine severity. Separate unrelated
   debt and unavailable required checks. Evidence-backed no-findings is valid.
5. Apply the [severity and merge contract](../agents/code-reviewer.md#severity-and-merge-contract).
   Resolve in-scope defects and required verification before declaring completion.
   Summarize the reviewed scope, actual checks and limitations. Push/merge/deploy
   require existing user authorization; this command grants none.
