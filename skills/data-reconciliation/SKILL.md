---
name: data-reconciliation
description: Reconcile intended business events with persisted records and downstream effects, investigating uncertain writes, duplicates, missing replication and safe repair.
---

# Data reconciliation

Use when success responses disagree with durable state, records may be duplicated or
financial/business effects span systems. Start read-only and use the existing plan.

## Define the expected event

Identify the source of truth, authorized intent, entity scope, correlation/idempotency
key and cutoff time. Compare like currencies, dates/timezones, frequencies, versions and
record states. Do not merge distinct cases because their amounts look similar. Specify
invariants such as one active promise per applicable scope, exact confirmed terms and
one logical notification or replicated event; use actual product contracts.

Trace request, durable write, response, retry, notification, replication and recovery
state. Classify matched, missing, duplicate, conflicting and pending records. Check
read consistency and expected propagation delay before declaring a missing effect.
A timeout after a write is an unknown outcome until persisted state resolves it.
Do not reactivate superseded records or repeat a non-idempotent write on that uncertainty.
[RFC 9110 §9.2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2) defines
HTTP idempotency; the business operation still needs its own deduplication contract.

## Repair within the authorized scope

Prepare a reviewable dry-run with affected keys, before/after state, preconditions,
idempotent action and rollback/compensation limits. Execute authorized repairs with
bounded batches and compare-and-set or equivalent concurrency protection. Stop on
unexpected state or conflicting ownership. Preserve the audit trail; never silently
rewrite customer intent. Record sensitive identifiers in controlled evidence only.

Verify durable postconditions and each required downstream effect. A queued retry is
pending, not completed. Distinguish safe retries, manual reconciliation and failed side
effects from successful primary writes. Add fault tests at the actual uncertain boundary
using [test-strategy](../test-strategy/SKILL.md).

## Deliverable and learning hooks

Provide counts with population/cutoff, redacted discrepancy evidence, executed repairs,
postconditions and unresolved items. Capture the missing deduplication, recovery or
visibility mechanism that allowed the discrepancy to survive.

> **Size budget: 4 KB** — `token-budget.mjs --check`.
