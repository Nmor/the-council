---
name: verify
description: Run comprehensive verification on current codebase state (build, lint, type, test, code-graph).
command: true
---

# Verification Command

> **Size budget: 8 KB** — `token-budget.mjs --check`.

Run comprehensive verification on current codebase state.

Follow [verification evidence](../rules/common/verify-before-claim.md). Use the
[run-check wrapper](../skills/verification-loop/references/run-check.sh) to capture
complete logs, bound displayed output and preserve the producer's exit status.
Do not pipe live checks to `head`/`tail` or mask a failure with `echo`.

## Instructions

Execute verification in this exact order:

1. **Build Check**
   - Run the build command for this project
   - If it fails, report errors and STOP

2. **Type Check**
   - Run TypeScript/type checker
   - Report all errors with file:line

3. **Lint Check**
   - Run linter
   - Report warnings and errors

4. **Test Suite**
   - Run all tests
   - Report pass/fail count
   - Report coverage metric and denominator; apply
     [canonical testing policy](../rules-library/common/testing.md)

5. **Console.log Audit**
   - Search for console.log in source files
   - Report locations

6. **Security Scan**
   - Run configured secret/dependency/security checks when required by scope or `pre-pr`
   - Report SKIPPED for unrun scans; never print Secrets OK without a completed scan

7. **Git Status**
   - Show uncommitted changes
   - Show files modified since last commit

## Output

Produce a concise verification report:

```text
VERIFICATION: [PASS/FAIL/INCOMPLETE]

Revision/environment/acceptance boundary: ...
Per check: command + completed exit status + evidence log + reason for skips
Build:    [PASS/FAIL/SKIPPED/UNAVAILABLE/INTERRUPTED/RUNNING]
Types:    [same states, X errors]
Lint:     [same states, X issues]
Tests:    [same states, X/Y passed; metric/denominator or UNAVAILABLE]
Secrets:  [same states, scan scope and findings]
Logs:     [same states, X console.logs]

Ready for PR: [YES/NO]
```

If any critical issues, list them with fix suggestions.

Only completed, inspected checks may PASS. Required failed, unavailable,
interrupted, running or skipped checks make readiness NO; a quick-mode pass covers
build/types only, and its other checks remain SKIPPED. Unsupported coverage metrics
are UNAVAILABLE, never inferred from another percentage.

## Arguments

$ARGUMENTS can be:

- `quick` - Only build + types
- `full` - All checks (default)
- `pre-commit` - Checks relevant for commits
- `pre-pr` - Full checks plus security scan
