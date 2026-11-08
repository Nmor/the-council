# The review proof protocol — every coding agent, every stack

> **Size budget: 5 KB** — `token-budget.mjs --check`.
>
> Sister to `done-criteria.md` (what must be true before a commit), `verify-before-claim.md`
> (evidence), `review-dimensions.md` (what a review must cover) and
> `targeted-test-runs.md` (how to check a mutation cheaply).

## Why a protocol and not just a rule

The rule — no commit of substantive code without an independent review and a verification gate —
is already written. What was missing is a way for that rule to be *checked* when more than one
agent works a repository.

The Claude Code hooks under `~/.claude/scripts/hooks/` bind one tool. They fire on that tool's
own calls and nothing else, so Codex, a second Claude session, another coding agent or a human
running `git commit` never triggers them. A rule enforced only there is enforced for one
participant in a repository several of them share — and the one it is enforced for is the only
one who can be blocked by it, which is the wrong way round.

Git runs a `pre-commit` hook for all of them. So the check lives there, and the proof it reads is
a file any agent can write.

## Install, once per repository

```sh
git config core.hooksPath .council/githooks
mkdir -p .council/githooks .council/proofs
ln -sf "$HOME/.claude/scripts/council-pre-commit.sh" .council/githooks/pre-commit
chmod +x .council/githooks/pre-commit
printf '.council/proofs/\n' >> .git/info/exclude
```

Proofs are local evidence about a local artifact; they are never committed.

## The proof format

Two files, written by whoever ran the thing:

```
.council/proofs/review.json   {"trees":["<hex>"],"reviewers":["agent:go-reviewer","agent:security-reviewer"],"at":<epoch_ms>}
.council/proofs/gate.json     {"tree":"<hex>","at":<epoch_ms>}
```

A tree is the artifact the check ran against — `git write-tree`, which records the index's
content and modifies nothing. Write the proof **after** it passes. The review proof carries
`trees` (plural) so it can bind both to the index and to a tree the brief names.

In Claude Code `review-marker.js` writes it, firing on **SubagentStop** as well as PostToolUse: a
reviewer is dispatched asynchronously, so its PostToolUse answer is `async_launched` and the
completion never arrives there. Measured 2026-10-29, before it was wired: a real `go-reviewer`
read a repository, reported a real defect and left no proof — unsatisfiable by a review that had
happened, which is how a gate gets switched off rather than met. A reviewer that stops without a report records nothing: stopping is not reviewing.

## Bind to the artifact, not to the working directory

This is the part that makes the protocol usable by several agents at once, and it was learned the
hard way: a proof bound to "the working directory is unchanged" is invalidated every time another
agent edits an unrelated file, so in a shared checkout it almost never survives long enough to
reach a commit. A proof bound to a **tree** says something stronger and more stable — *this exact
content was reviewed* — and nobody else's edits can touch it.

It also means the proof follows a private index. Where several agents share one checkout they
also share one index, and staging there means another agent's `git commit` can take your work.
Compose in your own index instead, and the same proof still applies because the tree is the same:

```sh
export GIT_INDEX_FILE=/tmp/mywork.index
git read-tree HEAD
git add path/to/my/files            # the shared index is untouched
git write-tree                      # the tree to review, and to record in the proof
git commit -m "..."                 # commits that index
```

## What the gate requires

- **Only for code.** A commit touching no code file in any of the supported languages passes
  untouched; docs, fixtures and config may land on their own.
- **A review proof naming this exact tree**, with **two or more distinct reviewers**. Two, because
  a reviewer looking for correctness and one looking for exposure do not read the same code.
- **A verification proof naming this exact tree** — build, test, lint or type-check, whichever the
  stack has.
- Proofs older than a day are refused, as is a proof timestamped in the future.

A proof naming a different tree is ignored rather than trusted. That is the whole point: it
cannot certify an artifact it never saw.

## What the gate cannot check, and you must

It records that a review **ran** against this artifact. It cannot read a verdict — that is prose —
so it cannot know whether findings were resolved. **Resolving every finding, and re-reviewing
after a fix, remains yours.** Writing the proof while findings are open is not a loophole in the
protocol; it is a false statement about your own work.

## Bypass

```sh
COUNCIL_GATE=off git commit ...
```

For a gate that is genuinely unavailable — no test runner in the container, no second reviewer
reachable. Say in the commit body which gate was unavailable and why. A bypass that is not
explained in the artifact it bypassed is indistinguishable from skipping the rule.
