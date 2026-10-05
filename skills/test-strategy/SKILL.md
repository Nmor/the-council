---
name: test-strategy
description: Select risk-based verification for features and defects, choosing test boundaries, independent oracles, realistic fixtures and evidence that detects meaningful failures.
---

# Test strategy

Use when deciding how to verify a substantive change or when existing tests pass while
users still see failures. Reuse the repository's test runner and relevant language rules.
Do not manufacture tests for trivial reversible edits or mirror implementation details.

## Choose tests from failure risk

Identify promised behavior, affected consumers and high-impact invariants. Choose an
independent oracle: customer agreement, persisted state, contract, known-good fixture or
measured external output. A mock response or the code's own calculation cannot establish
the downstream effect it claims. Use [requirements-acceptance](../requirements-acceptance/SKILL.md)
when the expected behavior is unsettled.

Select the cheapest boundary that detects each failure: unit for local decisions,
integration for real contracts/transactions, end-to-end for user-visible sequencing.
Include meaningful negative cases, retry after uncertain success, cancellation,
concurrency and partial failure where they threaten correctness. Keep existing-consumer
regressions in scope when shared behavior changes. Test observability if incident diagnosis
depends on it; sensitive values should remain redacted while correlation survives.

For recordings or transcript replay, preserve provenance, channel/timing boundaries and
initial state. Assert resulting decisions and durable effects rather than matching whole
sentences. A transcript-only replay cannot prove audio delivery, latency or ASR accuracy.
For nondeterministic systems, define repeated trials, distribution/threshold, seed or
sampling limitations. Use [eval-harness](../eval-harness/SKILL.md) for model evaluations.

## Report evidence honestly

Run repository lint and applicable checks; record command, revision, exit status and
artifact location. Distinguish passing, failing, skipped and unavailable checks. State
what remains untested, especially deployment and live integrations. Once appropriate
checks pass, broaden only for new failures or unresolved concerns. Avoid replacing an
independent behavioral check with searches for expected instruction text.

## Learning hooks

Record bugs that escaped a passing suite, their missing boundary and the regression added.
Prefer better oracles over additional low-value assertions or arbitrary coverage targets.

Reference: [NIST SP 800-218 v1.1, PW.8](https://csrc.nist.gov/pubs/sp/800/218/final).

> **Size budget: 4 KB** — `token-budget.mjs --check`.
