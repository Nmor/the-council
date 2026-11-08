#!/bin/sh
# Council pre-commit gate — agent-neutral.
#
# Size budget: 6 KB. Check: token-budget.mjs --check.
#
# WHY THIS EXISTS AS A GIT HOOK.
# The Claude Code hooks under ~/.claude/scripts/hooks/ bind one tool: they fire on that tool's
# own Bash calls and nothing else. Codex, another Claude session, a different coding agent or a
# human running `git commit` never triggers them, so a rule enforced only there is enforced for
# one participant in a repository several of them share. Git runs this for all of them.
#
# Install per repository (safe to re-run):
#   git config core.hooksPath .council/githooks
#   mkdir -p .council/githooks && ln -sf "$HOME/.claude/scripts/council-pre-commit.sh" \
#     .council/githooks/pre-commit && chmod +x .council/githooks/pre-commit
#   printf '.council/proofs/\n' >> .git/info/exclude
#
# WHAT IT CHECKS. A commit carrying code must be covered by proofs that an independent review
# and a verification gate actually ran against THIS artifact — the tree the commit will record,
# not the working directory. Binding to the tree is what makes a proof survive a second agent
# editing unrelated files in a shared checkout, and what makes it survive the index being shared:
# `git write-tree` here reports whatever index this commit is using, including a private one.
#
# THE PROOF FORMAT, so any agent can satisfy it without reading this script:
#   .council/proofs/review.json   {"tree":"<40-or-64-hex>","reviewers":["go-reviewer","security-reviewer"],"at":<epoch_ms>}
#   .council/proofs/gate.json     {"tree":"<hex>","at":<epoch_ms>}
# Write the file AFTER the check or review passes, with the tree it ran against. Get that tree
# with `git write-tree` (it does not modify anything). A proof naming a different tree is ignored,
# which is the point: it cannot certify an artifact it never saw.
#
# Bypass, deliberately explicit, and record the reason in the commit body:
#   COUNCIL_GATE=off git commit ...
set -eu

[ "${COUNCIL_GATE:-}" = "off" ] && exit 0

root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
proofs="$root/.council/proofs"
candidate=$(git write-tree)

# Only code obliges a review. Docs, fixtures and config may land on their own; a commit that
# changes no code is not the thing this gate exists for.
#
# The extension list comes from ONE shared file, which the Claude Code gate reads too. Two
# hand-kept lists drifted and disagreed about whether Dart, Elixir, Scala, shell, mjs, cjs or
# Svelte were code, so the same commit needed a review on one path and not the other.
exts=$(sed -e 's/#.*//' -e '/^[[:space:]]*$/d' -e 's/[[:space:]]//g' \
  "${COUNCIL_EXT_LIST:-$HOME/.claude/scripts/council-source-extensions}" 2>/dev/null |
  paste -sd '|' -)
# A missing list must not silently exempt every language.
[ -n "$exts" ] || { printf '[council-gate] BLOCKED: the source-extension list is missing.\n' >&2; exit 1; }
code=$(git diff --cached --name-only --diff-filter=ACMR |
  grep -Ev '(_test\.[a-z]+|_spec\.[a-z]+|\.test\.[a-z]+|\.spec\.[a-z]+)$' |
  grep -Ev '(^|/)(testdata|__tests__|spec|fixtures)/' |
  grep -E "\.($exts)\$" || true)
[ -z "$code" ] && exit 0

fail() { printf '[council-gate] BLOCKED: %s\n' "$1" >&2; blocked=1; }
blocked=0

# A proof is valid when it names this exact tree and is not absurdly old. Parsed with sed rather
# than a JSON tool so this runs in any container the agents are given.
proof_names_tree() {
  [ -f "$1" ] || return 1
  grep -o '"[a-f0-9]\{40,64\}"' "$1" | tr -d '"' | grep -qx "$2"
}
proof_age_ok() {
  at=$(sed -n 's/.*"at"[ ]*:[ ]*\([0-9]\{10,\}\).*/\1/p' "$1" | head -1)
  [ -n "$at" ] || return 1
  now=$(date +%s)
  # Milliseconds if it is long enough to be, else seconds.
  [ "${#at}" -ge 13 ] && at=$((at / 1000))
  [ $((now - at)) -lt 86400 ] && [ $((at - now)) -lt 600 ]
}

if ! proof_names_tree "$proofs/review.json" "$candidate"; then
  fail "no independent code review proof for this artifact (tree $candidate).
             A review of a different tree certifies nothing about this one. Dispatch reviewers
             matched to what changed, give them the diff and the acceptance rather than your
             conclusion, resolve every finding, then record the proof named in
             \$HOME/.claude/scripts/council-pre-commit.sh."
elif ! proof_age_ok "$proofs/review.json"; then
  fail "the code review proof has no usable timestamp, or is over a day old."
else
  # Two perspectives, because a reviewer looking for correctness and one looking for exposure do
  # not read the same code; the defects that motivated this were each found by only one of them.
  reviewers=$(sed -n 's/.*"reviewers"[ ]*:[ ]*\[\([^]]*\)\].*/\1/p' "$proofs/review.json" |
    tr ',' '\n' | sed -n 's/.*"\([^"]\{2,\}\)".*/\1/p' | sort -u | wc -l | tr -d ' ')
  [ "${reviewers:-0}" -ge 2 ] || fail "only ${reviewers:-0} reviewer perspective(s) recorded for
             this artifact; a deep review needs two or more matched to the surface."
fi

if ! proof_names_tree "$proofs/gate.json" "$candidate"; then
  fail "no verification gate ran against this artifact (build / test / lint / type-check).
             A commit is a claim, and a claim needs proof of the tree it is making it about."
elif ! proof_age_ok "$proofs/gate.json"; then
  fail "the verification proof has no usable timestamp, or is over a day old."
fi

if [ "$blocked" -ne 0 ]; then
  printf '[council-gate] Fix each, then commit. Record the tree with: git write-tree\n' >&2
  printf '[council-gate] Override only a genuinely unavailable gate: COUNCIL_GATE=off (say why in the body).\n' >&2
  exit 1
fi
exit 0
