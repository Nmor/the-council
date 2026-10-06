---
name: springboot-testing
description: Spring Boot testing discipline — TDD workflow with JUnit 5, @SpringBootTest slicing (@WebMvcTest, @DataJpaTest), MockMvc, Testcontainers, and the verification gates a Spring Boot change must pass before it ships (build, coverage floor, static analysis, integration checks). Use when writing Spring Boot tests or verifying a Spring Boot change is done.
paths:
  - "**/*Test.java"
  - "**/*Tests.java"
  - "**/*IT.java"
  - "**/*ITCase.java"
  - "**/src/test/**/*.java"
  - "**/src/test/**/*.kt"
  - "**/*Test.kt"
disable-model-invocation: true
---

# Spring Boot TDD Workflow

> **Size budget: 8 KB** — `token-budget.mjs --check`.

Spring Boot testing discipline — TDD workflow with JUnit 5, @SpringBootTest slicing (@WebMvcTest, @DataJpaTest), MockMvc, Testcontainers, and the verification gates a Spring Boot change must pass before it ships (build, coverage floor, static analysis, integration checks). Use when writing Spring Boot tests or verifying a Spring Boot change is done.

## Working procedure

1. Establish the relevant mode and existing evidence; do not repeat completed intake.
2. Choose unit, web, persistence or full integration tests by the boundary changed. Assert returned data and errors; use isolated databases and deterministic fixtures. Mocking a repository does not prove SQL transaction or migration behavior.
3. Read only the corresponding sections below before applying their examples.
4. Verify the result with meaningful positive, negative and failure controls. Record actual outcomes, limitations and next action.

## Selected references

- [When to Use](references/procedure.md#when-to-use) — read when this part of the task applies.
- [Workflow](references/procedure.md#workflow) — read when this part of the task applies.
- [Unit Tests (JUnit 5 + Mockito)](references/procedure.md#unit-tests-junit-5--mockito) — read when this part of the task applies.
- [Web Layer Tests (MockMvc)](references/procedure.md#web-layer-tests-mockmvc) — read when this part of the task applies.
- [Integration Tests (SpringBootTest)](references/procedure.md#integration-tests-springboottest) — read when this part of the task applies.
- [Persistence Tests (DataJpaTest)](references/procedure.md#persistence-tests-datajpatest) — read when this part of the task applies.
- [Testcontainers](references/procedure.md#testcontainers) — read when this part of the task applies.
- [Coverage (JaCoCo)](references/procedure.md#coverage-jacoco) — read when this part of the task applies.
- [Assertions](references/procedure.md#assertions) — read when this part of the task applies.
- [Test Data Builders](references/procedure.md#test-data-builders) — read when this part of the task applies.
- [CI Commands](references/procedure.md#ci-commands) — read when this part of the task applies.
- [Compliance & Standards Mapping](references/procedure.md#compliance--standards-mapping) — read when this part of the task applies.
- [When to Activate](references/procedure.md#when-to-activate) — read when this part of the task applies.
- [Phase 1: Build](references/procedure.md#phase-1-build) — read when this part of the task applies.

The [full procedure](references/procedure.md) preserves detailed examples and standards.
Load relevant excerpts rather than the entire reference. Runtime capabilities and higher-priority instructions govern imported templates.
