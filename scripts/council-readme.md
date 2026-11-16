# The Council

Engineering governance for coding agents. One install gives Claude Code,
Codex, Copilot, Grok and any `~/.agents`-reading CLI the same rules, the same
specialists, and the same gates.

## What's in the box

| Layer | Count | What it does |
| --- | --- | --- |
| Always-on rules | 30 | The floor: evidence before claims, decide-don't-ask, route-to-professionals delegation, untrusted-content hygiene. Budgeted to 24 KB so it never crowds your context. |
| Skills | ~146 | Language patterns, security standards (ASVS 5.0), planning, writing quality, UI anti-slop, domain benches (business, finance, hiring, SEO). |
| Specialist agents | 46 | Reviewers per language and division — security, design, config/markup, database, ops — each with declared boundaries so dispatch is unambiguous. |
| Gates | 4 | Markdown lint, link integrity, an 1,100+ test hook suite, floor-budget check. Green or it doesn't ship. |
| Debate procedure | 1 | When two sources of guidance conflict, they argue with evidence and the verdict is recorded. Case law, not vibes. |

## Why it exists

Agent output drifts generic without standing pressure: inflated prose,
templated UI, guessed versions, skipped verification. The Council replaces
that drift with named rules and measured feedback — its UI eval went from
7.4/14 to 9.2/14 in one find-fix-remeasure cycle, and both numbers are in the
repo.

## Install

```bash
./install.sh
```

Copies the corpus to `~/.claude`, symlinks skills into every agent home it
finds, and never overwrites an existing `CLAUDE.md` (a template ships as
`CLAUDE.md.example`). Paths are `~`-relative; nothing personal ships.

## Verify

```bash
skills/council-maintenance/tests/verify-link-integrity.sh
skills/council-maintenance/tests/md-lint.sh   # needs: brew install markdownlint-cli2
```

## Not bundled

Vendored packs install from their upstreams — the installer prints the exact
list (Anthropic design skills, taste-skill, Emil Kowalski's motion set,
impeccable, firecrawl, hypit, Cloudflare security-audit, Roast Room seats).
