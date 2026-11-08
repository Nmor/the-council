# Principal engineering quality contract

> **Size budget: 17 KB** — `token-budget.mjs --check`.

This contract applies to substantive planning, implementation and review in both
Claude Code and Codex. It sets observable acceptance, not a claim about a model's
seniority or a guarantee of flawless output. Read relevant sections on demand.
Project requirements, user scope, authorization and runtime capabilities govern.

## Outcome and design

Start from the requested behavior, affected consumers and current implementation.
Name invariants that must survive the change: authorization, money/data integrity,
ordering, latency, resource limits or compatibility as applicable. Distinguish
observed facts, assumptions and unresolved decisions. Investigate a material unknown
before making a dependent task ready; record what evidence will settle it.

For a material design or dependency choice, compare the existing solution and viable
alternatives against these requirements. Explain the decision, rejected alternatives,
costs, failure modes and conditions that would change it. Keep the decision in the
existing plan or repository's decision record; do not force a new ADR for routine work.
Use a useful service lifetime and plausible growth horizon, not an arbitrary decade.

Read the [task contract](plan-task-breakdown.md) when decomposing work. Map every
requested outcome to an owned task and a check that can fail. Cover producer/consumer
seams, required docs, failure behavior and authorized delivery. Small tasks must
retain complete acceptance; splitting is not permission to drop difficult parts.

## Implementation and complete functionality

Trace relevant behavior from public entry point through registration/configuration,
implementation, dependencies and consumers to the observable result. A helper,
flag or mocked function is not evidence that the live path uses it. Confirm replaced
paths stop influencing behavior and cleanup follows demonstrated consumer migration.

Read common and language guidance before coding. Prefer cohesive existing primitives
and explicit ownership. Preserve applicable strict lint, types, coverage and security
checks. Diagnose analyzer findings against actual semantics; do not weaken gates,
exclude changed files, add suppressions or discard errors to obtain a green result.

For relevant stateful or external effects, consider partial success, ambiguous writes,
retries, duplicate/reordered delivery, cancellation, timeouts, concurrency and restart.
Verify durable state and downstream effects, not just a returned status. Specify who
reconciles an uncertain outcome; never blindly retry a possibly completed effect or
report success while required effects failed. Handle return values and errors in
tests too. Go's `for _, value := range` is valid value iteration.

Check changed contracts, defaults, serialization, permissions, schemas and flags
against affected consumers and rollout order. A locally passing implementation can
still break another service. Use typed boundaries and stable, meaningful errors;
retain enough trace context to diagnose failures without exposing sensitive data.

Root-cause fixes must remove the cause and include an appropriate regression check.
Do not hide symptoms, disable a required feature, bypass authorization, mock away an
integration or leave requested functionality incomplete because it is harder. An
explicitly necessary containment measure is separate from the completed fix, with
remaining work, risk and recovery recorded. Do not declare acceptance passed for it.

## Evidence-based tools and dependencies

"Best grade" means demonstrably fit for the required correctness, security,
performance, operability and maintainability. A brand, newest release, premium model
or large number of tools is not evidence. Do not choose a weaker verification path
because the appropriate check is inconvenient. Record a required unavailable check
and its next action; do not relabel a mock or smoke check as equivalent evidence.

1. Inspect repository tooling, versions, supported environments and existing verified
   primitives. Use the strongest relevant configured diagnostics and tests.
2. For a material new choice, verify official documentation for the applicable version,
   support/security status, capabilities and constraints. Include licensing, privacy,
   portability, operating cost and lock-in when they affect the decision. Use current
   provider research when relevant; do not preload unrelated provider dossiers.
3. Compare viable choices against explicit requirements. A known supported tool may
   be the best choice; prefer an upgrade or new tool when evidence justifies it.
   Never invent benchmark results, automatic activation or installed capabilities.
4. Resolve decisive uncertainty with a bounded representative experiment: functional
   conformance, fault behavior, workload benchmark or integration check. Record the
   versions, inputs, result and practical limits. Separate vendor claims from observed
   behavior. Time or cost constraints do not turn an untested claim into proof.
   Measure a user-facing latency or throughput requirement at its complete boundary,
   including relevant queueing, persistence and downstream effects. Component timings
   help locate a bottleneck; they do not establish end-to-end acceptance.
5. Document the chosen tool, why it satisfies the requirements, any material gap and
   fallback/migration trigger. Respect the user's model choice and available native
   tools; Claude aliases and hook conventions do not control Codex. See
   [model/runtime guidance](../../skills/coding-quality-rules/references/performance-model-selection.md).

## Tests, comments and documentation

Use [testing guidance](../common/testing.md) for required gates and coverage metrics.
Inspect assertions: a green command or high coverage does not prove the intended
behavior. For substantive fixes, demonstrate the regression fails for the right
reason before the fix and passes afterwards when practical. Exercise relevant
negative/failure and compatibility cases with realistic dependency semantics.
Validate wiring or durable effects at the appropriate integration boundary rather
than relying solely on mocks. Reuse valid evidence for unchanged inputs.

Comments explain non-obvious intent, invariants, units, ownership/lifetime, retry or
concurrency constraints and contract behavior. Public API docs describe inputs,
outputs, errors and side effects where needed. Do not restate code or narrate the
current task. Follow [comment rules](../common/coding-style.md#comments--what-they-do-and-do-not-contain).
Update only the relevant maintained README/API/runbook/configuration surfaces so
their examples and claims match executable behavior.

## Review and PR acceptance

Use an explicit [review baseline](../common/git-workflow.md#review-baseline).
Include staged, unstaged and relevant untracked work for a workspace review, or
the actual divergence diff for a PR. Trace affected unchanged consumers as needed;
separate unrelated debt. Categories suggest investigations; severity follows
demonstrated impact, likelihood and repository requirements, not a checklist label.
Give a reproducible trigger, location, consequence and remediation for each finding.
An evidence-backed no-findings review is valid. Never invent findings to fill a quota.
Follow the actual control flow and documented dependency contract, including caught
exception types. An unknown is a question or verification gap until a supported
failure trace establishes a defect. Do not invent a retry, lost effect or exposure.
Distinguish data integrity from demonstrated monetary loss, and explain any CRITICAL
rating with its actual blast radius. Do not count one causal defect twice.

Resolve in-scope defects and required verification before declaring this work done.
Preserve the shared [severity and merge contract](../../agents/code-reviewer.md#severity-and-merge-contract).
A general WARN policy is not permission to defer a required correctness fix merely
because it is MEDIUM. Broader follow-up must have an explicit scope decision.

PRs explain the final problem and resulting behavior, reasons for material choices,
compatibility/rollout implications and actual verification. Refresh the title/body
after scope changes. Tie evidence to the reviewed revision and input/configuration;
separate passed, failed, skipped and unavailable checks. Follow the
[PR workflow](../common/git-workflow.md#pull-request-workflow); do not claim deployed,
installed or runtime verified based on local tests.

## Guidance maintenance and runtime limits

Skills and agents need accurate routing, valid examples and relevant acceptance
checks. Audit changed guidance and its consumers; remove contradictory duplicate
contracts or route to the canonical source. Test meaningful behavioral changes with
bounded realistic scenarios and retain failed attempts. Metadata/lint checks certify
structure only; synthetic model tests do not certify every future plan or live system.
For contamination checks, keep project/customer-specific facts in project instructions;
global guidance uses generic examples. Hook availability, trust and execution are
separate facts. Do not claim automatic enforcement from a Markdown file.

Keep context bounded, use one authoritative plan and preserve concurrent edits.
Delegation must serve a concrete independent question, within the active runtime's
limits. Principal quality comes from sound decisions and verified outcomes; repeated
full audits, forced committees and elaborate templates do not substitute for either.
