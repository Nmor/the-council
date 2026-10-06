# Council local runtime evidence — 2026-10-05

This bundle records the user-authorized local Codex and VS Code checks for
`/Users/APPLE/claude-council`, branch `fix/council-code-quality-20260928`, base
`759f9286c051753c7c99f8a1c4c8ec593ccd79e7`. The candidate includes uncommitted source
changes. This evidence does not indicate publication or installation into the user's
live Council homes.

## Native Codex

[Codex 0.159.2 discovery](codex-discovery-0.159.2.json) and
[Codex 0.160.0 discovery](codex-discovery.json) contain filtered actual app-server
responses from `initialize`, `config/read`, `skills/list` and `hooks/list` under
`app-server --stdio --strict-config`. Both live and private candidate homes parsed
without discovery errors. Each exposed one enabled Council router and five native
hooks. Live hooks were trusted; new private hooks were untrusted. Trust was not changed.

The candidate installer verified 1,101 managed files. Its separate `runtime: not checked`
field remains unchanged: installer integrity alone does not verify runtime behavior.
The actual RPC responses provide the additional configuration/discovery evidence.

[Offline prompt summary](prompt-summary.json) records both actual CLI renders,
item/text counts, raw-file hashes and byte sizes. Each render declared the compact
Council router once and retained the instruction forbidding native execution of
archived Claude hooks. Latest serialized input size was 15,952 bytes. Full private
prompt text is excluded. These renders generated no model turn and do not measure
tokens or repeated-turn context growth.

## Actual VS Code extension-host checks

VS Code 1.140.0 ran with isolated user-data paths and private copies of installed
Claude Code 2.1.289 and Codex 26.5930.51102 extensions. Settings Sync and private
profile updates were disabled. No personal settings file or real-workspace trust
record was edited. Codex used a private candidate home without copied authentication.
Extension and built-in app activation may still create their own temporary files.

| Receipt | Window and trust | Completed acceptance |
| --- | --- | --- |
| [Current folder](vscode-current-folder.json) | Fresh restricted folder | Settings inspected; extensions unavailable/inactive |
| [Current empty window](vscode-current-empty.json) | VS Code default trusted empty window | Extensions active; Codex app-server initialized |
| [Candidate folder](vscode-candidate-folder.json) | Fresh restricted folder | Four explicit extension values correct; extensions unavailable/inactive |
| [Candidate empty window](vscode-candidate-empty.json) | Strict candidate empty-window trust disabled | Four explicit values correct; extensions unavailable/inactive |
| [Candidate diagnostic empty window](vscode-candidate-empty-default-trust.json) | Private overlay restoring VS Code default empty-window trust | Four explicit values correct; extensions active; Codex app-server initialized |

The diagnostic overlay changed only the private empty-window preference. It did not
trust a real project or grant hook trust. Startup acceptance required completion of
the test API, registered Codex commands, the `Initialize received` app-server log
marker, no observed IPC-router/fatal-process error, and application exit 0.
No conversational model turn was sent. Extension activation by itself was insufficient.

Each run also parsed the three source JSONC templates and checked all eight Claude/
Codex setting assignments against installed manifest keys, types and enums. Three
negative controls rejected an obsolete setting and invalid enum values. Cursor and
Windsurf were schema-checked only; their applications were not launched.

[Source provenance](source-provenance.json) records the templates, installer guide,
extension manifests and temporary test scripts as they were at runtime validation.
The installer guide subsequently received documentation-only corrections; its
historical hash is intentionally preserved. [Documentation follow-up](documentation-followup.json)
records the new documentation hashes and checks. The runtime templates and harnesses
were unchanged. The scripts are local harnesses,
not new production test dependencies. A read-only independent Council review found
no remaining template defect. The final schema/startup checks used the newer Codex
extension after the earlier review inspected 26.5928.31416.

## Failures, limitations and final gates

[Harness history and limitations](limitations.json) retains earlier failures and
corrections. In particular, macOS Unix socket path length limits required short
temporary paths; a CLI launch returning zero did not establish a completed test.
No failed wrapper attempt is represented as successful runtime acceptance.

Computer Use permission was unavailable; UI clicking and rendered panel behavior
were not tested. Four earlier Claude factual-discipline retests still failed and
remain in the separate [behavioral evaluation](../../../skills/evidence/2026-10-05/README.md).
These startup/configuration checks neither close those failures nor establish that
Claude's compaction thrashing is resolved.

A GitHub OAuth callback appeared during testing; its exact origin was not established.
The temporary listener was gone after the test instances exited. GitHub authentication
was unnecessary. Authorization codes, tokens, nonce/state values and full auth logs
are not included here. Built-in VS Code warnings are not certified as fixed.

[Terminal verification](verification-receipts.json) records final documentation and
artifact checks. [Artifact inventory](artifact-inventory.json) records byte sizes and
SHA-256 hashes of the other bundle files; it does not hash itself. Raw temporary
paths provide provenance and may expire. The filtered receipts and summaries remain
reviewable in this source worktree.
