# Testing Requirements

> Apply when the active task requires test guidance. Sister to `done-criteria.md`,
> `extreme-lint-policy.md`, `tdd-workflow` skill, `tdd-guide`
> agent, `task-intake-due-diligence.md` (Q14 test strategy).
>
> **Size budget: 8 KB** — `token-budget.mjs --check`.

## Coverage thresholds (canonical)

Repository and explicit user requirements take precedence. In their absence, use
these defaults for substantive code changes; identify the tool, metric and scope:

- **Touched files**: ≥ **90%** line + branch coverage
- **Project total**: ≥ **80%** line + branch coverage
- **Critical paths** (auth, payments, data-mutation, multi-tenant
  isolation): ≥ **95%** line + branch coverage where supported

Touched-file, project and critical-path denominators are separate gates; a project
average cannot certify touched code. Unsupported branch/line metrics are
UNAVAILABLE, not inferred from statement coverage. Go's native coverage instruments
approximate basic blocks and reports statement coverage; it does not measure branch
coverage or short-circuit `&&`/`||` outcomes. Use explicit behavioral cases for those
outcomes and report the native metric honestly. See [Go coverage](https://go.dev/blog/cover).

Use configured coverage gates (with a below-threshold negative fixture) for supported
metrics. Coverage is a floor, not evidence that assertions detect defects. A harmless
prose/config edit needs proportionate verification, not manufactured coverage.

## Test types (choose by changed risk and failure boundary)

Per `task-intake-due-diligence.md` Q14, select applicable types and record why others
are not needed. Do not demand every type for every change:

1. **Unit tests** — every pure function / pure logic branch.
2. **Integration tests** — changed external boundaries (DB, queue, cache); exercise
   real isolated transactions and durable state where persistence matters. Unit mocks
   do not prove database behavior; recorded/provider fixtures need separate contract checks.
3. **Contract tests** — producer / consumer schema agreements
   (per the `api-design` skill's "Response-shape contracts" section).
4. **E2E tests** — every critical user journey (Playwright,
   Cypress, Detox, XCUITest per platform).
5. **Property-based tests** — invariants for parsers,
   validators, state machines.
6. **Load / performance tests** — for hot paths or new
   services.
7. **Chaos / fault-injection** — when the system claims
   resilience (retries, circuit breakers, failover).
8. **Security tests** — relevant SAST, DAST, dependency-CVE and secret-scan gates
   for changed inputs, integrations and attack surfaces.
9. **Accessibility tests** — axe-core / pa11y / equivalent for
   every UI surface.

## Test-Driven Development (scale to task risk)

Follow explicit user and repository requirements. Use this workflow for substantive
behavior changes where a failing regression or acceptance test can verify the change;
prose, configuration and reversible low-impact edits need proportionate checks.
Per `tdd-workflow` skill:

1. **RED** — write the failing test FIRST.
2. **VERIFY RED** — run the test; it must fail for the right
   reason (assertion fails, not import error).
3. **GREEN** — write the minimal implementation that makes the
   test pass.
4. **VERIFY GREEN** — run the test; it passes.
5. **REFACTOR** — improve the implementation; tests stay green.
6. **VERIFY COVERAGE** — coverage meets the threshold above.

Assert observable outputs, stable errors, side effects and durable state. Inject the
fault, invoke the operation and assert its error response; for writes, independently
read committed state. Negative controls must fail if an error is suppressed or a
write is lost. Unit mocks and integration/contract evidence serve different boundaries.

## Troubleshooting test failures

Per `proper-fixes-first.md`:

1. Use relevant TDD guidance; delegate only when authorized and useful.
2. Check test isolation (no shared state across tests).
3. Verify mocks are correct (they don't lie).
4. Fix the IMPLEMENTATION, not the test — unless the test is
   testing the wrong thing (rare).
5. If a test is genuinely flaky, quarantine + investigate;
   never weaken the assertion to make it green.

## Test files have NO exemption

Per `no-discards.md`, every value bound + every error handled
applies in test files too. Handle return values/errors; Go's `for _, value := range`
is allowed. Assert on `error_code` rather than fragile message copy
(per `error-handling-with-context.md` rule 10).

## Agent support

- **tdd-guide** — guidance for applicable substantive features;
  RED-GREEN-REFACTOR and the canonical policy above
- **e2e-runner** — Playwright / equivalent E2E flows
- **code-reviewer** — flags missing tests in PR review

## Cross-references

- `extreme-lint-policy.md` — complementary strict lint gates
- `done-criteria.md` — every "done" claim runs the test gate
- `tdd-workflow` skill — RED-GREEN-REFACTOR methodology
- `task-intake-due-diligence.md` Q14 — test strategy planned
  in the intake
- `api-design` skill ("Response-shape contracts" section) —
  contract tests between BE + FE shapes
- `error-handling-with-context.md` — assertions on
  `error_code`, not on copy-edit-fragile messages

## Learning hooks

Per `~/.claude/rules/common/continuous-learning-mandate.md`:

**Signals to watch**:

- Coverage on touched files < 90% (canonical threshold violation)
- Project coverage < 80% (sister `extreme-lint-policy.md` weakening)
- Critical-path coverage < 95% (auth / payments / data-mutation / multi-tenant isolation)
- TDD RED-VERIFY skipped — test never confirmed to fail for the right reason (workflow weakening)
- Mocked external boundary used instead of recorded fixture / contract test (integration-test
  contract drift)
- Property-based test absent for a parser / validator / state machine (test-type gap)
- E2E test absent for a critical user journey (test-type gap)
- Test asserts on `message` instead of `error_code` (sister-rule violation — copy-edit fragility)
- Test file added with discards / suppression directives (no-discards weakening in test files)
- Flaky test quarantined without root-cause fix (TDD discipline weakening)

**Refinement candidates**:

- New test-type row when a recurring test class emerges (e.g., chaos test, fuzzing target, snapshot
  regression)
- Tightening of the critical-path coverage floor when a regression slips past 95%
- New cross-reference when a sister skill (django-testing, springboot-testing,
  swift-protocol-di-testing) extends test-type taxonomy
- New "test isolation" failure-mode template when a recurring shared-state contamination class
  appears
