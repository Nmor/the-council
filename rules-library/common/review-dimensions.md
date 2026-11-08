# Review dimensions every code review must cover

> Shared by `code-reviewer` and every language reviewer, which link here rather than restating
> it. Sister to `wiring-and-usage-review.md`, `no-bloat.md`, `idempotency.md`,
> `no-silent-failures.md`, `functional-test-coverage.md`.
>
> **Size budget: 6 KB** — `token-budget.mjs --check`.

## Why this exists

A review that reads only the diff finds only the defects visible inside it. The classes below
are invisible there by construction — they live in what the diff's symbols connect to, what
happens on the second attempt, and what a caller is told when a step fails — and they cost the
most once shipped, because each looks correct in isolation.

Recorded case (2026-10-28): a change passed every lint gate and a whole-module test run, yet
granted a stored credential Super Admin, printed an API token into an error and burned an
idempotency key for imports that never started. None was findable from the diff alone.

## 1. Dependencies and usages — trace, do not infer

- **Every new or changed exported symbol: name its live consumer.** Not "it will be used" —
  the call site, by file and line. A symbol the change INTRODUCED with no caller is bloat
  (`no-bloat.md`). A caller-less symbol the change INHERITED is a question, not a verdict:
  triage what it was for, and name the alternative that covers its use case before any delete.
- **Every changed signature, interface, error, status code, DTO field, config key or env var:
  list what consumes it** and say whether each still behaves. A widened interface forces every
  implementation; a renamed JSON field breaks a client that no test covers.
- **Follow the wiring to observable behaviour** (`wiring-and-usage-review.md`): entrypoint →
  registration → construction → the path a request actually takes. Check it is reachable, that
  configuration and secrets arrive where the code reads them, and that a nil or absent
  dependency is answered rather than dereferenced. A flag the running process never reads is
  dead regardless of how correct the code behind it is.
- **Trace at least one path end to end.** Structural reasoning misses what tracing finds.

## 2. Idempotency and retry safety

- **Assume every operation runs twice.** Retries, redeliveries and at-least-once queues are the
  normal case, not the exception. For each side effect ask: what happens on the second run?
- **A duplicate must be refused or absorbed, not applied.** Charging, sending, incrementing,
  importing and granting are the operations where a double application is visible to a customer.
- **Where is the key?** An idempotency key must be claimed BEFORE the effect, not recorded
  after it — a record written afterwards does not exist during the window a retry lands in.
- **Is a burned key recoverable?** A key held for an operation that provably never started
  blocks the retry it exists to enable. Prefer releasing on refusals the downstream made before
  doing any work, and give keys an expiry so the surface heals without an operator.
- **Concurrency**: two callers at once. A check-then-act in application code is a race; a
  unique constraint or a conditional write is not.

## 3. Partial failure and what it leaves behind

- For a multi-step operation, ask what state exists when step N fails: a created remote object
  with no local record, a local record pointing at nothing, a transaction holding a lock across
  a network call.
- **Order the steps so the recoverable state is the one that survives.** Record the binding
  before declaring success, so an interruption is resumable rather than invisible.
- An unknown outcome is its own answer. "It failed" and "it may have happened" call for
  opposite next actions, and collapsing them invites a retry that double-applies.

## 4. Failure visibility

- Every failure, fallback and degraded path: what does the operator see, where is it recorded,
  and what does the end user get? (`no-silent-failures.md`, `ui-ux-quality-bar.md`.)
- A swallowed error, a default returned in place of a failure, and a log line nobody routes are
  all silent failures.
- Check the message survives the transport: a generic 5xx redaction can replace the one
  instruction the caller needed.

## 5. Tests that would fail

- For each behaviour the change claims: name the test that fails if it breaks. If gutting a
  function leaves the suite green, the suite does not cover it.
- Check the fixtures are faithful to the real dependency at its pinned version. A fixture that
  answers more simply than the real thing produces a test that passes for the wrong reason —
  a 20-byte payload where the real refusal only appears above a buffer boundary.
- Refusal tests must assert the REASON (the code), not only the status class.

### Mutate, but scope the run

Reading a test says what it asserts; mutating says whether it bites. Mutate — then run ONLY the
test that should fail, never the suite. Measured here, a DB-backed Go package runs in 500s and
one of its tests in 8s: three mutations cost 25 minutes or 24 seconds on that choice alone.
Every stack has a single-test selector; [targeted test runs](targeted-test-runs.md) lists them.

- **It must compile**, or it proves nothing while looking just like a caught mutation. Where
  deleting a line leaves a variable unused, mutate the VALUE (`x, err := real(), error(nil)`).
- **Quote the failure message, not "caught"** — it shows the test failed for the right reason.
- One whole-suite run confirms nothing else regressed: the author's to supply, yours to
  spot-check, not to repeat per mutation.

## One pass

One review round per commit: report every CRITICAL, HIGH, MEDIUM and LOW finding now, none held
back. Confirming a fix: check only its lines; nothing new outside them unless CRITICAL or HIGH.

## How to report

For each dimension, either a finding with file:line and a concrete failure scenario, or an
explicit statement that it was checked and is clean. "Looks fine" is not a review of these.
