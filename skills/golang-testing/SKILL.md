---
name: golang-testing
description: Go testing patterns including table-driven tests, subtests, benchmarks, fuzzing, and test coverage. Follows TDD methodology with idiomatic Go practices.
disable-model-invocation: true
---

# Go Testing Patterns

> **Size budget: 8 KB** — `token-budget.mjs --check`.

Go testing patterns including table-driven tests, subtests, benchmarks, fuzzing, and test coverage. Follows TDD methodology with idiomatic Go practices.

## Working procedure

1. Establish the relevant mode and existing evidence; do not repeat completed intake.
2. Handle every returned value and error in tests. Test observable behavior, error paths and concurrency where applicable; run race detection for shared state. Go coverage reports statements/basic blocks and does not establish branch coverage.
3. Read only the corresponding sections below before applying their examples.
4. Verify the result with meaningful positive, negative and failure controls. Record actual outcomes, limitations and next action.

## Selected references

- [When to Activate](references/procedure.md#when-to-activate) — read when this part of the task applies.
- [TDD Workflow for Go](references/procedure.md#tdd-workflow-for-go) — read when this part of the task applies.
- [Table-Driven Tests](references/procedure.md#table-driven-tests) — read when this part of the task applies.
- [Subtests and Sub-benchmarks](references/procedure.md#subtests-and-sub-benchmarks) — read when this part of the task applies.
- [Test Helpers](references/procedure.md#test-helpers) — read when this part of the task applies.
- [Golden Files](references/procedure.md#golden-files) — read when this part of the task applies.
- [Mocking with Interfaces](references/procedure.md#mocking-with-interfaces) — read when this part of the task applies.
- [Benchmarks](references/procedure.md#benchmarks) — read when this part of the task applies.
- [Fuzzing (Go 1.18+)](references/procedure.md#fuzzing-go-118) — read when this part of the task applies.
- [Test Coverage](references/procedure.md#test-coverage) — read when this part of the task applies.
- [HTTP Handler Testing](references/procedure.md#http-handler-testing) — read when this part of the task applies.
- [Testing Commands](references/procedure.md#testing-commands) — read when this part of the task applies.
- [Best Practices](references/procedure.md#best-practices) — read when this part of the task applies.
- [Integration with CI/CD](references/procedure.md#integration-with-cicd) — read when this part of the task applies.

The [full procedure](references/procedure.md) preserves detailed examples and standards.
Load relevant excerpts rather than the entire reference. Runtime capabilities and higher-priority instructions govern imported templates.
