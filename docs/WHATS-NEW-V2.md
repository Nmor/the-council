# The Council v2 — What's New

PR [#19](https://github.com/Nmor/the-council/pull/19) merged to `main` on
2026-11-16 (merge commit `7d4cab1`, 29 commits). Gates measured at the merged
tree: Python suite 169 tests passing (1 environment skip), Node hook suite
1170/1170, markdownlint 0 errors across the corpus.

## Decision-making and debate

- **Best-idea-wins conflict resolution** with recorded case law
  (`rules-library/council-detail/settled-debates.md`). 61 cross-source guidance
  contradictions were resolved with recorded verdicts.
- **Debate-frame session hook**: instructions injected by third-party plugins
  are demoted to debate positions — they argue their case against Council rules
  instead of silently overriding them. User scope and safety rules stay
  non-debatable floors.

## Measured quality loop

- UI output quality is now **measured, not asserted**: an eval baseline scored
  7.4/14; one find-fix-remeasure cycle brought it to 9.2/14, with all 24 scored
  defects repaired against computed evidence.

## Delegation and resource awareness

- **Route-to-professionals delegation**: specialist-owned work goes to that
  specialist; independent deliverables run in parallel, bounded by a **live
  resource gate** (load/swap advisory at spawn time).
- Explicit cheaper-model selection for mechanical fan-out; the session model is
  reserved for judgment work.

## Hooks and security

- **Hook dispatcher consolidation**: one dispatcher process per tool event
  (previously up to 9 spawns per edit), with deadlines and fail-open reporting.
- **25 security rules merged in-house** into `post-edit-security-nudge.js` with
  full path-class coverage — no external plugin dependency.
- **ASVS 5.0**: citations remapped, with the official OWASP requirements and
  pinned ID mapping bundled in the skill.
- Concurrent audit writers now wait on the private-file lock (monotonic
  two-second deadline) instead of dropping events under contention.

## New skills, agents and intake

- Skills: **writing-quality** (anti-AI-prose), **character-design**,
  **app-market-intel**.
- Agents: **design-reviewer** and **config-reviewer**.
- **Domain-aware intake** with deterministic routing to domain skills and the
  **12 Founder Board advisory seats**. Routing recognizes normal word forms
  (negotiation, manufacturing, fundraising, recruiting) while keeping
  word-start boundaries so unrelated code terms don't trigger it.

## Windows support

- Skill sync creates **native directory links on Windows** (Git Bash) as well
  as Unix, preserves owner entries, and refuses failed link creation rather
  than silently falling back to copies.
- Windows test fixtures use Git Bash discovered in supported layouts, isolate
  the native home, and use platform-specific dispatcher quoting.

## Codex installer and reconciliation hardening

- **Legacy-install reconciliation**: `--reconcile` adopts a pre-existing
  install without losing owner-written guidance — including text added outside
  the managed Council block — and the full reconcile → uninstall → reinstall
  cycle is tested.
- **Owner-retained files** (`local: true`) are never overwritten,
  ghost-deleted, or pruned by sync; legacy pruning touches only mirror records,
  preserving the uninstall backups native entries depend on.
- Older native manifests **migrate through the same installer**; other
  harnesses keep skill propagation and broken-link diagnostics without
  expanding Codex's profile.
- **Dual-parser frontmatter guarantee**: every agent and skill description
  parses identically under PyYAML and Codex's lightweight importer (verified
  across all 197 files: 58 agents, 139 skills).
- Partial tool dispatchers get **paired direct pre/post mutation guards with
  isolated state**, so the post-hook can always inspect its captured baseline.
- Published and context-only installs now ship the **shared hook runtime
  libraries** (compaction and tool hooks need them); context migration refuses
  conflicting personal copies.

## Proof chain and publishing

- Complete **commit-bound proof chain**: proof recorder, installer, and native
  pre-push launcher. Pushes require gate + coverage + two-reviewer review
  proofs bound to each outgoing commit.
- The push template resolves the **current `$HOME`** (portable installs);
  reinstalling refreshes stale v2 launchers without replacing the original
  hook body or its backup.
- **Publish script** with a foreign-directory guard (refuses a target without
  `.council-dist` unless `--force` is passed) and a complete installer;
  native instruction templates retain the decision, quality, task-breakdown,
  review, and progress contracts across installs.
- Runtime version guidance is **registry-verified**: .NET 10 LTS, Spring
  Boot 4, Rails 8.1, Go 1.27, Node 26, PostgreSQL 18, TypeScript 7, JUnit 6,
  USCDI v7.

## Corpus hygiene

- Markdown corpus **lint-clean (4,189 errors → 0)** with a markdownlint gate
  (`.markdownlint-cli2.jsonc` at the repo root) and a link-integrity gate
  (`tests/verify-link-integrity.sh`); all internal paths `~`-relative; hosted
  verification
  now checks every Founder Board seat, supporting reference, and named source
  link.

## Third-party packs installed alongside The Council

These install **from their upstreams and are not bundled** (licensing stays
with the authors; the installer prints this list after every install).
Everything the Council built *around* them — routing rules, precedence
verdicts, review agents — is in this repo.

- **Design and UI**: Anthropic's design five (`anthropics/skills`:
  frontend-design, canvas-design, brand-guidelines, theme-factory,
  algorithmic-art); **taste-skill** (`Leonxlnx/taste-skill`) for
  marketing/landing direction; **Emil Kowalski's pack** (`emilkowalski/skills`)
  for motion and app-UI polish (animate, choreograph, gestures, break-ui, and
  the rest); **impeccable** (`pbakaus/impeccable` plugin) for
  `/impeccable polish` and `/impeccable audit`.
- **Security**: **security-audit** (`cloudflare/security-audit-skill`) for
  full-codebase audits and pen-test prep, complementing the in-repo security
  stack.
- **Research and web**: **firecrawl** (`firecrawl/skills`) — search, scraping,
  crawling, monitoring, file parsing, research-paper lookup.
- **Media**: **hypit** (`hypit-ai/hypit`) for generated video production.
- **Advisory**: **Roast Room / Founder Board** (`nateherkai/roast-room`) — the
  12 seats (Bezos, Buffett, Musk, Graham, Naval, both Hormozis, Gary Vee,
  Martell, Blakely, Sanchez, Wickman), each grounded in a compiled corpus of
  public sources. Seats need `~/roast-room` locally, which is why they're
  excluded from the published bundle; the Council's intake routes business
  questions to the right seat automatically.
- **Conflict resolution between packs** is settled by the UI precedence ladder
  in `rules/common/ui-ux-quality-bar.md`: project tokens → the brief → Emil skills
  (motion/app UI) → taste-skill (marketing direction) → ui-ux-pro-max (lookup
  only).
