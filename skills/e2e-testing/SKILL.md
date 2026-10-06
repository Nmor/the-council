---
name: e2e-testing
description: Playwright E2E testing patterns — Page Object Model, configuration, CI/CD integration, artifact management, flaky test strategies, PLUS the decision-time patterns that come before the first test is written (black-box helper scripts, static-vs-dynamic routing, multi-server orchestration, reconnaissance-then-action, application-state readiness assertions).
disable-model-invocation: true
---

# E2E Testing Patterns

> **Size budget: 8 KB** — `token-budget.mjs --check`.

Playwright E2E testing patterns — Page Object Model, configuration, CI/CD integration, artifact management, flaky test strategies, PLUS the decision-time patterns that come before the first test is written (black-box helper scripts, static-vs-dynamic routing, multi-server orchestration, reconnaissance-then-action, application-state readiness assertions).

## Working procedure

1. Establish the relevant mode and existing evidence; do not repeat completed intake.
2. Choose critical observable user journeys and test against an authorized isolated environment. Use locator actions and web-first assertions; avoid fixed sleeps and blanket network-idle waits. Keep secrets out of artifacts. Browser rendering, hydration and accessibility checks may be needed even for static HTML.
3. Read only the corresponding sections below before applying their examples.
4. Verify the result with meaningful positive, negative and failure controls. Record actual outcomes, limitations and next action.

## Selected references

- [Purpose](references/procedure.md#purpose) — read when this part of the task applies.
- [When to use](references/procedure.md#when-to-use) — read when this part of the task applies.
- [When NOT to use](references/procedure.md#when-not-to-use) — read when this part of the task applies.
- [Standards cited](references/procedure.md#standards-cited) — read when this part of the task applies.
- [Decision-time patterns (BEFORE writing a single test)](references/procedure.md#decision-time-patterns-before-writing-a-single-test) — read when this part of the task applies.
- [Test File Organization](references/procedure.md#test-file-organization) — read when this part of the task applies.
- [Page Object Model (POM)](references/procedure.md#page-object-model-pom) — read when this part of the task applies.
- [Test Structure](references/procedure.md#test-structure) — read when this part of the task applies.
- [Playwright Configuration](references/procedure.md#playwright-configuration) — read when this part of the task applies.
- [Flaky Test Patterns](references/procedure.md#flaky-test-patterns) — read when this part of the task applies.
- [Artifact Management](references/procedure.md#artifact-management) — read when this part of the task applies.
- [CI/CD Integration](references/procedure.md#cicd-integration) — read when this part of the task applies.
- [Test Report Template](references/procedure.md#test-report-template) — read when this part of the task applies.
- [Summary](references/procedure.md#summary) — read when this part of the task applies.

The [full procedure](references/procedure.md) preserves detailed examples and standards.
Load relevant excerpts rather than the entire reference. Runtime capabilities and higher-priority instructions govern imported templates.
