---
name: requirements-acceptance
description: Turn ambiguous feature requests or reported defects into observable acceptance criteria, preserving user intent and tracing requirements to verification evidence.
---

# Requirements and acceptance

Use when the requested behavior, completion criteria or affected users are unclear.
For a small explicit change, keep the criteria inline in the existing task or plan.

## Establish the contract

Read the relevant implementation and current plan. Describe the concrete trigger,
actor, initial state and expected result. Separate stated requirements, existing
contracts, assumptions and proposed scope; do not promote an assumption to a requirement.
Resolve material contradictions using evidence or a focused question while progressing
with independent work. Preserve previous authorization and accepted decisions.

Define observable criteria with IDs only when traceability benefits the task. Include
failure, retry, cancellation and partial completion where relevant; cover accessibility,
privacy and compatibility when the affected surface requires them. State quantities with
units, measurement boundaries and environments. A response code alone cannot prove that
a promised durable effect occurred. Specify what must remain true for existing consumers.

## Connect delivery to evidence

For each criterion, identify the implementation surface, verification method, expected
observation and evidence location. Use [test-strategy](../test-strategy/SKILL.md) for
complex verification choices. Keep the mapping in the authoritative plan, issue or
repository artifact already used by the project, rather than creating a second plan.

Accept a criterion only with evidence at the required boundary. Separate implemented,
locally tested, integrated and runtime verified. Report gaps with the next check and
owner; unresolved assumptions stay visible. Update criteria when the user changes scope.

## Deliverable

Provide the behavior contract, acceptance/evidence mapping and remaining decisions.
Scale this to the request; a one-line fix does not need a requirements document.

## Learning hooks

Record an ambiguous requirement that caused rework and the observation that would have
resolved it. Suggest a reusable criterion only after repeated evidence, without adding
automatic policy or approval gates.

Security requirements reference: [NIST SP 800-218 v1.1, PO.1](https://csrc.nist.gov/pubs/sp/800/218/final).

> **Size budget: 4 KB** — `token-budget.mjs --check`.
