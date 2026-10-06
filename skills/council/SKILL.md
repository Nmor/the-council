---
name: council
description: Route substantive engineering work to the relevant Council rules, skills and one justified specialist review.
---

# Council

Follow the compact working contract in `~/.claude/CLAUDE.md`. Inspect existing work
and the project's authoritative plan; consider architecture, implementation,
quality, security and testing. Work in the main session by default. Invoke one
bounded specialist only when an independent investigation or review adds evidence.

Find only relevant resources under `~/.claude/skills/`, `~/.claude/agents/` and
`~/.claude/rules-library/`. Search filenames/descriptions before reading a selected
file. Do not enumerate or read the whole library into the conversation.

Before editing, read `rules-library/common/coding-style.md` and the applicable
language's coding/testing rules. Use `skills/council-rules/SKILL.md` for specialist
routing when needed; detailed protocol templates are for explicitly deep reviews.
The other skills remain manually invocable and readable under compact discovery.

Read only the current handoff and relevant plan sections. Continue the accepted
task after compaction; do not reload historical plans, rerun intake or repeat valid
reviews. Keep verbose logs in files and return concise results and evidence paths.
Preserve user sessions, memory and other agents' work. User scope and existing
authorization take precedence over imported procedural examples.

Primary reference: [Claude Code skills](https://code.claude.com/docs/en/skills).

> Size budget: 4 KB. Check: wc -c; gate: token-budget.mjs --check.
