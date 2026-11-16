# Post-commit review and verification — every coding agent

> Size budget: 6 KB.

Council, Claude, Codex and other coding agents follow the same sequence:
complete implementation → local commit → independent review and required checks
→ corrective commits and confirmation → authorized push of accepted work.
No review rounds in worktrees. Reviews inspect committed objects directly.

Commit hooks do not require review or testing. The native Git pre-push hook checks
the actual source and destination object IDs supplied by Git, including pushes of
branches other than HEAD, tags, several refs and merges. No remote operation is
needed to validate the hook offline. Install it with
`node scripts/install-commit-workflow.js <repo> [<repo>...]`.
It preserves an enabled shell pre-push hook at its original path after Council's
check, including its stdin and `$0`. Disabled hooks stay disabled; unsupported
non-shell hooks require explicit integration without replacing them.
Install the same launcher in the configured Git template's hooks directory for
future repositories. Do not replace unrelated repository hooks.
Installations exclude `.council/proofs/` using Git's resolved local exclude file;
exclude it globally as well for repositories initialized from the template.
Only Git's actual destination object and the default branch read live from the
push URL exclude existing history. This requires a protected default branch
(reviewed merges, no direct pushes). New refs otherwise need evidence for all
reachable commits; cached tracking refs never establish acceptance. Grafts and
replacement refs are disabled; fetch full history before publishing shallow repos.

## Evidence

Keep evidence outside version control:
`.council/proofs/commits/<full-commit-id>/review.json` and `gate.json`.
Both name the exact commit, its tree and an `at` time in epoch milliseconds after
the commit was created. A staged-tree or session marker cannot authorize a push.
A commit never inherits approval from another commit with the same tree.

Review proof:

```json
{"commit":"<full-id>","tree":"<tree-id>","at":0,"verdict":"approved","findings_remaining":0,"reviewers":["independent-language-reviewer","independent-security-reviewer"]}
```

Verification proof:

```json
{"commit":"<full-id>","tree":"<tree-id>","at":0,"exit_code":0,"checks":[{"command":"<actual required check>","exit_code":0}],"coverage":93.2}
```

Examples use placeholders: replace time and identifiers with actual evidence.
Substantive source requires two distinct independent reviewer perspectives and
measured coverage; other commits still need an independent review and appropriate
verification, such as documentation or configuration checks.
Only record actual completed reviews and terminal successful required checks.
Any unresolved finding, failed required check or missing evidence blocks publication.
Legacy hook markers remain diagnostics and do not satisfy this protocol.

When findings require a corrective commit, the original's final review may add
`"resolved_by":["<full-fix-commit-id>"]`. Approval is conditional: every pushed
tip containing that original must also contain each named descendant correction.
The correction needs its own review and checks. Missing or invalid fix objects
fail closed; the defective original cannot be published alone, including a
rewind that transfers no new commits. Conditional receipts are checked against
all pushed tips independently of the transfer census.

Each correction must rerun every original check. Match its argument digest when
present, otherwise its exact command label. Never combine results across trees.
Unrelated passing checks cannot replace failed requirements.

A failed original gate may likewise add `resolved_by` while retaining its actual
failed command results. This means accepted only with verified descendants;
it never means the original tests passed. Each named correction must have its
own terminal-successful exact gate, successful required checks covering the
original failures, and measured coverage for source changes. Conditional gate
chains are refused. These constraints also apply to rewinds and already-published
corrections; review and documentation requirements remain separate.

Record actual terminal checks with
`scripts/council-record-proof.sh gate --commit <id> -- <required-command>`;
use `coverage` instead of `gate` for a command emitting measured Go or Node
coverage. The recorder executes a raw snapshot of the committed blobs, removes
that temporary source afterward, and binds its receipt to the commit and tree.
Git replacement refs, export attributes and checkout filters cannot substitute
the tested input. Gitlinks require an explicit verified submodule snapshot; the
recorder refuses them rather than silently omitting their code. Parent-traversing
symlinks also require explicit verification outside this recorder: filesystem
case/normalization aliases defeat lexical containment. The raw snapshot
also rejects platform-ambiguous backslash paths and symlinks that resolve outside
the temporary source directory.
This is not a review worktree. Command arguments are retained only as a digest,
not credential-bearing text. Failed reruns invalidate prior successful receipts.
Concurrent recordings of the same commit are refused; rerun after the active
recording finishes (a crashed recorder's lock needs explicit local cleanup).

Evidence is a local trust boundary: the recorder observes command completion, but
cannot establish that an arbitrarily chosen command is the required test suite or
that a reviewer identity is honest. The reviewer and owner verify that correspondence.
Do not hand-write successful outcomes without the underlying receipts.

Set `COUNCIL_PUSH_AUTHORIZED=yes` or `CLAUDE_PUSH_AUTHORIZED=yes` for an explicitly
authorized push only. This authorizes the operation; it cannot bypass evidence.
No automatic expiry is imposed on immutable commit evidence. Changed commits
(including amend/rebase) need their own evidence. Project plan completion, explicit
push authorization and any stricter publication rules remain in force.
