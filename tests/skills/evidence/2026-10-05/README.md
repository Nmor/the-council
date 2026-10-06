# Council source-fed behavioral evidence — October 5, 2026

This bundle preserves 26 advice drafts across six synthetic scenarios: entrepreneurship,
authorized pentesting, audit evidence, financial/test boundaries, creative adaptation
and database/performance review. It includes failed attempts and subsequent source-fed
retests. It is not a blanket model-quality pass or a live installation certificate.

The [frozen protocol](codex-initial/protocol.json) contains 19 mandatory core criteria
and six deliberately wrong advice candidates. The [manual grading](manual-grading.json)
separates core outcomes from the supplemental factual-discipline criterion added before
Claude retests. Latest selected drafts meet the core criteria. Four Claude retests had
failed the supplemental criterion by making unsupported factual claims; after
absence-as-fact discipline edits to the lead source file per scenario, the
[G1 retest](claude-g1-retest/protocol.json) passed all four with core criteria intact.
The first 04-sdlc-quality attempt over-corrected into meta-talk (core absent) and is
preserved; the test-strategy wording was rewritten to license reasoning from the brief's
stated premises before the passing attempt. Grading stayed rubric-aware and non-blinded
by the same grader who edited the sources — a bounded result, not a universal advice
pass. The earlier Codex reviewer draft failed R3 by omitting server-authorized tenant
identity; its final draft corrects that omission. Every attempt remains available.

| Run | Artifacts | Boundary |
| --- | --- | --- |
| Native Codex initial, six drafts | [Manifest](codex-initial/manifest.json), [consistency verification](codex-initial/verification.json), [source snapshots](codex-initial/source-snapshots.json) | Helper self-grading, not independently blinded |
| Native Codex targeted retest, four drafts | [Manifest](codex-retest/manifest.json), [source snapshots](codex-retest/source-snapshots.json) | Original failed R3 draft retained |
| Native Codex final retest, three drafts | [Manifest](codex-final/manifest.json), [source snapshots](codex-final/source-snapshots.json) | Same helper had seen grading feedback; rubric-aware |
| Claude initial, six drafts | [Manifest](claude-initial/manifest.json) | Isolated CLI print mode, tools disabled |
| Claude targeted retest, four drafts | [Protocol](claude-retest/protocol.json) | G1 frozen before these drafts |
| Claude final retest, three drafts | [Protocol](claude-final/protocol.json) | Core improvements do not erase G1 failures |
| Claude G1 retest, four drafts + preserved over-correction | [Protocol](claude-g1-retest/protocol.json) | Sources edited by the grader; rubric-aware, not blinded |

[inventory.json](inventory.json) lists every raw case, request, response, manifest and
snapshot artifact with its SHA-256 and size. Original JSON files are copied byte for
byte, including Claude prompts, stdout, stderr, terminal exit status and runtime usage.
Codex Markdown responses are preserved verbatim inside `*.response.json`; snapshots
are preserved inside `source-snapshots.json` under their original source paths. Snapshot
paths in original manifests therefore identify keys in those containers. Requests may
retain old logical procedure names; actual supplied sources and hashes are authoritative.

Native Codex used the inherited parent model; its exact model ID is unavailable through
the accessible runtime. Claude CLI 2.1.261 reports actual `modelUsage` in each raw case,
including automatic auxiliary/fallback models. These trials explicitly supplied source
instructions. They do not test automatic routing, installed/trusted hooks, asset renders,
campaign publishing, active pentesting or production financial/database integrations.
`execution_ok` establishes API/process completion, not advice correctness.

[Artifact validation](artifact-validation.json) checks snapshot hashes, wrapped raw
response hashes and the exact source bytes in Claude prompts. The
[verification receipts](verification-receipts.json) preserve completed local test/lint
summaries and the failed independent run. These are local evidence, not signed
attestations or hosted CI results.

The [cumulative audit](../../../../docs/SKILLS-HOOKS-AUDIT-2026-10-05.md) records the
source fixes, deterministic regressions, fault tests and remaining evidence boundaries.
