# Git Workflow

> **Size budget: 8 KB** — `token-budget.mjs --check`.

## Per-org git identity (set before the first commit)

When a developer or agent works across multiple GitHub organisations
with distinct email identities (personal account, employer org, side
project org, client orgs), the canonical shape is:

1. **Global default** in `~/.gitconfig` — set to the most-used or
   least-sensitive identity (typically personal).
2. **Per-org override** via `[includeIf
   "hasconfig:remote.*.url:https://github.com/<org>/**"]` blocks
   loading a `~/.gitconfig-<org>` snippet that pins `user.name`,
   `user.email`, AND `user.signingkey`.
3. **Per-org signing key** registered as a *Signing Key* (not just
   an Authentication Key) on the matching GitHub account.
4. **First-touch protocol**: on first clone / first edit of a repo
   from a new org, the agent verifies `git config user.email`
   matches the org's identity BEFORE the first commit. Mismatched
   commits create attribution accidents; never rewrite already-
   pushed history without explicit user authorization.
5. **Per-workspace specifics** (exact identities, signing-key paths,
   path-coverage globs) live in that workspace's `.claude/rules/`,
   not in global. Global states only the principle.

## Commit Message Format

```text
<type>: <description>

<optional body>
```

Types: feat, fix, refactor, docs, test, chore, perf, ci

Honor the repository's attribution and signing settings; do not infer global
configuration or change it from this reference.

## Review baseline

State what is being reviewed and record the base/head or worktree state. For local
work, inspect `git status --short`, `git diff --cached`, `git diff`, and relevant
untracked files (list with `git ls-files --others --exclude-standard`, then read
the intended source files). Protect secrets and exclude generated artifacts by
understanding their purpose, not by silently dropping authored changes.

For a PR or branch, identify its actual target and use `git diff <base>...HEAD`,
with the relevant commit patches and affected consumers. For requested commit
reviews, use their patches, not just commit names. A clean worktree does not imply
an empty review. Missing base/context is a stated limitation; do not guess a default
branch or review arbitrary recent commits instead. Record pending work separately
from the committed PR diff. Reuse evidence only when its inputs remain applicable.

## Pull Request Workflow

When creating PRs:

1. Analyze the full divergence diff and relevant history, not just the latest commit.
2. Lead the title/body with the concrete problem and resulting behavior. Explain a
   before/after trigger when useful, scope and reasons for material design choices.
   Describe the final implementation for a reviewer without the conversation.
3. Include affected contracts/consumers, migrations, defaults/flags, documentation
   and deployment order or rollback when material. Identify real remaining risks
   and unfinished required work; do not fill the body with speculative checklists.
4. Report actual verification: command/method, result, reviewed revision or worktree
   evidence, relevant inputs and what it proves. Separate passed, failed, skipped
   and unavailable checks; include the next action for required outstanding checks.
   Coverage alone does not prove assertions, integrations or durable effects.
5. Resolve in-scope review findings and required checks. Refresh title, body and
   evidence when scope changes. Do not describe planned checks as completed or claim
   production verification from local tests.
6. Push, create/update a PR, merge or deploy only within existing user authorization.
   Do not request the same permission twice. A workflow reference grants none.

For a simple change, a short problem/behavior paragraph and validation may suffice.
For a complex change, use the repository template and enough contract/evidence
detail to make the decision reviewable. Omit abandoned approaches unless they explain
a current tradeoff. Include useful implementation comments rather than PR narrative
in source; follow [comment guidance](coding-style.md#comments--what-they-do-and-do-not-contain).

## Feature Implementation Workflow

1. Inspect existing work and the authoritative plan. Use the
   [task contract](../council-detail/plan-task-breakdown.md) for substantive planning
   and the [principal quality contract](../council-detail/principal-level-mandate.md)
   for design, tool decisions and complete acceptance. Routine fixes need no new plan.
2. Follow [testing guidance](testing.md): regression evidence for substantive behavior
   changes, meaningful assertions, relevant failure/compatibility/integration checks
   and applicable strict touched/project/critical-path gates. Do not weaken checks.
3. Review the actual changes and affected seams. Use relevant specialist guidance;
   a concrete independent review may justify an available helper within active
   delegation limits. Do not force a separate agent for every stage.
4. Apply the [severity and merge contract](../../agents/code-reviewer.md#severity-and-merge-contract).
   Resolve all in-scope correctness defects and required verification; severity is
   not a reason to leave requested functionality unfinished. Separate broader debt
   through an explicit scope decision.
5. Record the compact handoff/evidence, then follow the user's commit and delivery
   policy. Use meaningful conventional commits if committing is authorized.

## Learning hooks

Per `~/.claude/rules/common/continuous-learning-mandate.md`:

**Signals to watch**:

- Commit authored with wrong identity for the target org (per-org `includeIf` block missing or
  misconfigured)
- Commit unsigned when the repo's policy requires signing (signing-key not registered for that org's
  identity)
- First-touch protocol skipped — agent commits before verifying `git config user.email` matches the
  org (rule "First-touch protocol" weakening)
- PR created from only the latest commit's diff instead of the full divergence diff vs base (PR
  workflow violation)
- Branch pushed without `-u` flag on first push (workflow weakening — upstream tracking missing)
- TDD coverage gate of 70% used instead of canonical 90% touched / 80% project (sister rule
  `extreme-lint-policy.md` weakening — stale threshold)
- Already-pushed history rewritten without explicit user authorization
- Conventional-commits type misused (e.g., `feat:` for a pure refactor; `fix:` for a feature)

**Refinement candidates**:

- New conventional-commit type row when a recurring change class needs distinct labelling (e.g.,
  `revert:`, `deps:`, `i18n:`)
- Tightening of the per-org first-touch check when identity mismatches recur in retrospectives
- New cross-reference when a sister rule (plan-completion-before-push, no-overclaim) provides a
  pre-push gate
- New PR template row when a recurring section (security checklist, accessibility checklist) belongs
  in every PR body
