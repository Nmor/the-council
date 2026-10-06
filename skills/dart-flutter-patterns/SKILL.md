---
name: dart-flutter-patterns
description: Dart 3.x / Flutter discipline — null safety mandatory; force-unwrap (!) banned outside justified narrow cases; const constructors everywhere possible; Riverpod / BLoC for state; freezed for immutable models + sealed unions; go_router for navigation; structured concurrency via async/await + Stream; Material 3 / Cupertino theming via tokens; analyser at fatal-infos + fatal-warnings. Select explicitly when this guidance applies.
paths:
  - "**/*.dart"
  - "pubspec.yaml"
  - "**/pubspec.yaml"
  - "pubspec.lock"
  - "**/pubspec.lock"
  - "analysis_options.yaml"
  - "**/analysis_options.yaml"
disable-model-invocation: true
---

# dart-flutter-patterns

> **Size budget: 8 KB** — `token-budget.mjs --check`.

Dart 3.x / Flutter discipline — null safety mandatory; force-unwrap (!) banned outside justified narrow cases; const constructors everywhere possible; Riverpod / BLoC for state; freezed for immutable models + sealed unions; go_router for navigation; structured concurrency via async/await + Stream; Material 3 / Cupertino theming via tokens; analyser at fatal-infos + fatal-warnings. Select explicitly when this guidance applies.

## Working procedure

1. Establish the relevant mode and existing evidence; do not repeat completed intake.
2. Handle async errors, lifecycle/disposal and every return value. Separate domain logic from widgets; preserve accessibility and platform semantics. Choose only coding/testing/security or hooks sections needed for the change; Claude hook names do not imply native Codex support.
3. Read only the corresponding sections below before applying their examples.
4. Verify the result with meaningful positive, negative and failure controls. Record actual outcomes, limitations and next action.

## Selected references

- [Standards Cited](references/procedure.md#standards-cited) — read when this part of the task applies.
- [Dart/Flutter Coding Style](references/procedure.md#dartflutter-coding-style) — read when this part of the task applies.
- [Dart / Flutter Hooks](references/procedure.md#dart--flutter-hooks) — read when this part of the task applies.
- [Dart / Flutter — No-Discards Extension](references/procedure.md#dart--flutter--no-discards-extension) — read when this part of the task applies.
- [Dart / Flutter Patterns](references/procedure.md#dart--flutter-patterns) — read when this part of the task applies.
- [Dart/Flutter Security](references/procedure.md#dartflutter-security) — read when this part of the task applies.
- [Dart/Flutter Testing](references/procedure.md#dartflutter-testing) — read when this part of the task applies.

The [full procedure](references/procedure.md) preserves detailed examples and standards.
Load relevant excerpts rather than the entire reference. Runtime capabilities and higher-priority instructions govern imported templates.
