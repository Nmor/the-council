> Detailed reference. Loaded on demand from `rules/common/done-criteria.md`; not part of the
> eager Floor. Read it when preparing a commit of substantive code.
>
> **Size budget: 4 KB** — `token-budget.mjs --check`.

# The pre-commit deep review

> Enforced by `scripts/hooks/commit-gate.js` rule (e), recorded by
> `scripts/hooks/review-marker.js`. A commit carrying code cannot land without it.

## Why it exists

Commit `9a64a858` (BFREE comms stack, 2026-10-28) passed `go build`, `go vet`,
`staticcheck`, `golangci-lint` with 0 issues, the repository's declared `gosec` policy with
0 remaining findings, and a whole-module test run at exit 0. It still:

- created the credential the service stores for every tenant's Listmonk instance against the
  **Super Admin** role, so a leak of that token could mint admins, repoint a tenant's SMTP at
  another relay, or garbage-collect its subscribers; and
- formatted the struct holding a generated **API token** into an error with `%+v`, printing
  the token to stderr on a mismatch.

Both were found by a review **after** the commit landed (fixed in `7795dcf7`). No gate in that
list can see either defect, because no gate reads code for intent. That is the gap this closes.

## What makes a review deep

| Requirement | Why |
| --- | --- |
| Two or more independent reviewers | A reviewer looking for correctness and one looking for exposure do not see the same code. Neither defect above was found by a single reading. |
| Matched to the surface | A language reviewer exists for every supported stack: `go-reviewer`, `typescript-reviewer`, `python-reviewer`, `ruby-reviewer`, `php-reviewer`, `java-reviewer`, `rust-reviewer`, `dotnet-reviewer`, `mobile-reviewer`. Plus `security-reviewer` for credentials, authorization, tenancy, money, user data; `database-reviewer` for migrations; `infra-reviewer` for charts, ArgoCD, workflows; `ops-reviewer` for monitors and runbooks; `code-reviewer` for correctness; `architect` when the change embodies a design decision. |
| Applies the shared dimensions | Every reviewer applies `review-dimensions.md`: dependencies and usages, idempotency and retry safety, partial failure, failure visibility, tests that would fail. A review that reads only the diff cannot see these, which is why they are enumerated rather than left to judgement. |
| Reads the implementation AND its consumers | A diff read alone cannot show that a new symbol has no caller, that a nil concrete pointer in an interface field defeats a nil guard, or that a sibling path was left inconsistent. |
| Traces at least one path end to end | Route → handler → service → repository → wire. Structural reasoning misses what tracing finds. |
| Given the diff and the acceptance, never your conclusion | A reviewer handed a conclusion returns it. Ask to be contradicted on the decisions you are least sure of. |
| Every finding resolved or answered | A dismissal needs a stated reason, recorded in the plan entry with the verdict and reviewer. |
| Re-run after a fix | The proof is bound to the source digest, so any edit invalidates it — exactly as it invalidates a test run. |

## Exempt

Docs-only commits, a test fixture, and a one-line fix that ships with a control. The gate
follows the same `code` classification the docs rule uses, so docs- and test-only commits pass
through untouched.

## The deepest option

`/code-review ultra` launches a multi-agent cloud review of the branch. It is user-triggered
and billed, so it cannot be started on the user's behalf — offer it for a change whose blast
radius warrants it.
