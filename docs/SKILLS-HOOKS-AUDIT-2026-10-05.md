# Council skills and hooks audit — 2026-10-05

The original audit found **18 improvement areas: four P1, thirteen P2 and one P3**.
The focused QA review adds **six P2 findings**. The agents/divisions/language review
adds **sixteen findings: seven P1 and nine P2**, bringing the cumulative total to
**40: eleven P1, twenty-eight P2 and one P3**. These totals include earlier findings
with source remediation; they are not counts of wholly open issues. Overlapping routing,
context and behavioral gaps retain their existing IDs. The most urgent
defects are command-gate bypasses, failed tests being accepted as verification, and
unredacted persistence of secret-shaped text. Passing structural tests did not catch these.

Source fixes now cover all **40 findings**, including the hooks, QA guidance, specialist
agents, divisions and language examples. Regression and fault tests exercise their
reported failure modes. Final follow-up receipts appear below; historical review
sections preserve the original defects and evidence rather than describing current code.
Changes remain uncommitted, unpushed and uninstalled in the live Claude/Codex homes.
Source acceptance is separate from installed, trusted and production runtime behavior.
Supplemental behavioral acceptance: the four Claude retests that had made unsupported
claims passed a bounded G1 retest after absence-as-fact discipline edits to the lead
source per scenario; raw failures, one preserved over-correction and the passing drafts
are all retained. Rubric-aware, non-blinded, one draft per attempt — not a universal pass.
The local Codex/VS Code follow-up found and fixed one additional P2 IDE configuration
defect, I2, bringing the source-remediated total to **41: eleven P1, twenty-nine P2
and one P3**. H11 (Stop-gate evidence blind spots, P1) and H12 (per-request Council activation
removed, not replaced, P1) — both found from the owner's live reports — raise it to
**43: thirteen P1**; both fixes are installed live (owner-chosen) and in source. The historical tables below retain their original 40-finding scope.
Targeted local configuration, discovery and extension startup checks now pass;
the new resources remain absent from the live installations.

## Scope and evidence boundaries

- Source: `/Users/APPLE/claude-council`, branch `fix/council-code-quality-20260928`,
  base revision `759f9286c051753c7c99f8a1c4c8ec593ccd79e7`; cumulative worktree
  edits existed before this implementation batch and were preserved.
- Installations: `/Users/leyanu/.claude` and `/Users/leyanu/.codex`. Comparisons covered
  tracked Council resources and registered hooks, preserving personal configuration.
- Every skill entrypoint and hook registration was inventoried. Library-wide searches,
  installation comparisons and structural checks were supplemented by targeted manual
  review and fault fixtures. This does not certify every instruction or all 130 skills'
  model behavior. Remediation adds four entrypoints, bringing the source catalog to 134.
  Bounded independent Council reviews investigated hooks and the new procedure scenarios;
  only one helper was active at a time, without recursive delegation.
- Dangerous command examples below were serialized hook inputs, never executed. Targeted
  fault fixtures used private temporary HOME/TMPDIR directories and fake credentials.
  The initial broad Node suite inherited the normal environment; finding H10 covers that gap.
- No actual credential exposure, destructive execution, unauthorized push, damaged live
  session or cause of the user's compaction thrashing was established by these probes.
- Installed, integrity-checked, trusted and runtime-verified are separate states. This audit
  did not change hook trust or run a new model/API evaluation of the entire library.

The existing authoritative plan is `/Users/leyanu/.claude/plans/glowing-riding-sphinx.md`,
under “Council skills and hooks audit handoff — 2026-10-05”. This report is evidence for
that plan, not a competing implementation plan.

## Inventory and installation findings — initial audit baseline

The following comparison predates remediation. Changed source files now intentionally
differ from installed resources; the four new skills are tested in candidate payloads,
and have not been installed into either live runtime.

| Surface | Result | Meaning |
| --- | --- | --- |
| Source skill entrypoints | 130; 1,663,409 bytes in total | On-disk library size, not loaded prompt size |
| Skill descriptions | 39,993 bytes in total | Discovery cost depends on runtime/profile |
| Claude skill copies | All 130 match source or the intended compact transform | Availability verified |
| Codex archived procedures | All 130 match the intended adaptation | Catalog availability verified |
| Tracked skill supporting files | 458; no Claude/Codex mismatches | References currently present |
| Top-level hook JavaScript files | 42 | File count differs from registration count |
| Source Claude hook registrations | 48; 38 without explicit registration timeouts | Timeout policy needs review |
| Active Claude registrations | 52; 38 without explicit registration timeouts | Four extra model-exhaustion registrations |
| Active Codex registrations | Five, each with a 20-second timeout | Intentional native compatibility surface |
| Native install integrity | 1,054 files passed at source revision `759f928` | Current runtime/trust not certified |
| Source eager instruction floor | 20,023 / 24,576 bytes | Within its aggregate cap |

At the initial comparison, all Claude hook files matched source except `model-ladder-gate.js`, whose installed
copy includes a semantic correction described in H7. The four extra registrations use
`model-exhaustion-marker`; their presence alone is not a defect. Codex does not promise
event-for-event Claude parity. Current Claude documentation includes `PreModelSwitch` and
`PermissionDenied`; these events must not be incorrectly reported as unsupported.
[Claude hook reference](https://code.claude.com/docs/en/hooks).

## Prioritized findings — initial defects and acceptance criteria

| ID | Priority | Finding | Evidence status |
| --- | --- | --- | --- |
| H1 | P1 | Compound commands bypass destructive-command checks | Reproduced |
| H2 | P1 | Push authorization and flags are scoped incorrectly | Reproduced |
| H3 | P1 | Audit/session persistence does not redact secrets | Fake-secret reproduction |
| H4 | P1 | Failed verification and empty coverage satisfy commit checks | Reproduced |
| H5 | P2 | Predictable marker writes follow symlinks | Temporary victim reproduction |
| H6 | P2 | Native Go advisories suppress independent failure feedback | Reproduced |
| H7 | P2 | Source model classifier treats directory names as task intent | Source reproduced; installed correction exists |
| H8 | P2 | Native error context is unbounded; hook timeouts are incomplete | Error reproduced; timeout risk is static |
| H9 | P2 | Typecheck failures can disappear silently | Missing-compiler reproduction |
| H10 | P2 | Hook tests inherit live home and temporary state | Source confirmed; actual state damage unknown |
| S1 | P2 | Reference guidance contradicts compact/manual routing | Source and installed references confirmed |
| S2 | P2 | Large skill entrypoints weaken progressive disclosure | Complete inventory |
| S3 | P2 | Behavioral evaluation is incomplete and one recommendation remains unreliable | Prior scenario evidence |
| I1 | P2 | Context migration omits new skills' supporting resources | Empty-home payload reproduction |
| Q1 | P2 | Citation verifier overstates what it validates | False-citation reproduction |
| Q2 | P3 | Size-budget coverage is incomplete | Complete gate output and source review |
| M1 | P2 | Marketing and SEO coverage lacks complete task workflows | Catalog and targeted content review |
| D1 | P2 | Creative coverage is narrow and visual guidance imposes blanket aesthetics | Source content review |

### H1 — Compound commands bypass destructive-command checks

[destructive-command-gate.js](../scripts/hooks/destructive-command-gate.js), lines 115–142,
classifies a whole command from its first word. A standalone dangerous deletion returns
exit 2, but an `echo` prefix followed by `;` or `&&` makes it return 0. The same problem
applies to executable actions embedded in otherwise read-oriented commands.
[command-scan.js](../scripts/hooks/lib/command-scan.js), line 27 onward, also strips
file-directed heredocs without retaining substitutions in unquoted heredocs.

Required improvement: inspect each executable command and its expansions; remove blanket
read-only exemptions for compound commands. Acceptance must include separators, pipelines,
subshells, command substitutions, `find -exec`, and quoted versus unquoted heredocs, alongside
safe literal-text controls. These hooks supplement runtime permissions; they are not a sandbox.

### H2 — Push authorization and flags are scoped incorrectly

[pre-push-gate.js](../scripts/hooks/pre-push-gate.js), lines 104 and 147–154, returns after
an acceptable commit and applies authorization/inspection flags across the entire string.
`git commit -m x && git push origin main` passes. So does
`CLAUDE_PUSH_AUTHORIZED=yes true; git push origin main`, where authorization belongs to
another command. `echo --dry-run ; git push origin main` passes; removing the whitespace
before the semicolon blocks it, exposing inconsistent token handling.

Required improvement: continue scanning after commits and associate flags, authorization
and protected-ref checks with each push invocation. Acceptance must prove unrelated flags
or assignments cannot authorize a later push, while a genuinely authorized invocation and
a genuine push dry run retain their intended behavior. Never execute the fixture pushes.

### H3 — Audit/session persistence does not redact secrets

[permission-denied-audit.js](../scripts/hooks/permission-denied-audit.js), line 33,
[tool-failure-recorder.js](../scripts/hooks/tool-failure-recorder.js), line 36, and
[session-end.js](../scripts/hooks/session-end.js), line 48, retain raw reason/error text
or user-message excerpts. A fake AWS secret assignment survived in both JSONL logs and a
session summary. Files were created as 0644 under umask 022; effective access depends on
ancestor permissions. Truncation did not remove the secret-shaped value.

Required improvement: redact before persistence, explicitly create private directories
and files, and document retention. Acceptance must cover common credential/token formats,
multiline messages, restrictive permissions and bounded retention. No real credential
exposure was demonstrated, so existing logs should be inspected without printing their contents.

### H4 — Failed verification and empty coverage satisfy commit checks

[gate-marker.js](../scripts/hooks/gate-marker.js), line 35, ignores results;
[test-coverage-marker.js](../scripts/hooks/test-coverage-marker.js), line 45, accepts an
empty measurement; [commit-gate.js](../scripts/hooks/commit-gate.js), line 157, checks
marker existence. In a staged temporary repository, the commit gate changed from exit 2
to exit 0 after simulated `go test ./... -cover` results explicitly reported exit 1 and
no coverage. The resulting coverage marker contained `measured: ""`. A command whose
test invocation was skipped after `false &&` also produced a verification marker.

Required improvement: require terminal success and genuine coverage evidence; bind
structured records to the applicable source state and verification attempt. Acceptance
must reject failures, skipped commands, running/unknown results, empty measurements and
stale evidence. Preserve explicit unavailable-check reporting rather than inventing success.

### H5 — Predictable marker writes follow symlinks

[gate-marker.js](../scripts/hooks/gate-marker.js), line 47, follows a precreated marker
symlink. A fixture overwrote a separate temporary victim file. This establishes unsafe
state handling, not a demonstrated cross-user exploit on the installed machine.

Required improvement: use a private state directory, validate ownership/type, reject
symlinks and replace records atomically. Acceptance should cover symlinks, malformed IDs,
stale records and concurrent writers. Concurrency stress was not performed in this audit.

### H6 — Native Go advisories suppress independent failure feedback

[codex/hooks.py](../codex/hooks.py), line 179, returns a nonempty Go-guard response before
evaluating independent command feedback. A failed `go test ./...` result with missing
correlation IDs emitted only the correlation warning. Dispatcher tests in
[test_hooks.py](../tests/codex/test_hooks.py), line 20 onward, mock that guard to `{}`.

Required improvement: merge independent advisories and failure/authorization feedback
within one bounded response. Acceptance needs unmocked dispatcher integration cases with
failed commands, missing IDs, unavailable scanners and valid baselines. The correlation
warning is appropriate; hiding the separate failure is the defect.

### H7 — Source model classifier treats directory names as task intent

[model-ladder-gate.js](../scripts/hooks/model-ladder-gate.js), line 261, includes `cwd`
in its security classification. The same benign README-spacing request switching to
Fable passed under `/tmp/example` and blocked under `/tmp/auth-service`.

The active Claude copy already omits this `cwd` signal. Required improvement: reconcile
that correction into source with a regression test; preserve legitimate task-based
security classification and personal configuration. Do not overwrite the installed fix
with the current source as an alleged integrity repair.

### H8 — Native error context is unbounded; hook timeouts are incomplete

[codex/hooks.py](../codex/hooks.py), line 205, interpolates a complete exception into
`systemMessage`. A malformed registry with a 9,000-character plan path produced 9,163
stdout bytes, repeating the path. This is a fault fixture, not measured normal overhead
or proof of the user's compaction-thrashing cause.

Required improvement: cap/sanitize native error messages and budget aggregate event output.
Also review the 38 Claude registrations without explicit timeouts, choosing event-specific
limits. Existing child-process limits, such as 15-second formatting and 30-second
typechecking, mitigate some cases. Claude documents long default command-hook timeouts;
matching hooks may run concurrently, so state writers need coordination as well.
[Claude hook reference](https://code.claude.com/docs/en/hooks).

Acceptance must include oversized/malformed configuration and a deliberately hung fixture,
showing bounded feedback and timely completion without disabling required security checks.

### H9 — Typecheck failures can disappear silently

[post-edit-typecheck.js](../scripts/hooks/post-edit-typecheck.js), lines 54–92, filters
errors to lines containing the edited filename. A private `npx` stub returning 127 with
a missing-compiler message produced no advisory and exit 0. Configuration failures,
timeouts or diagnostics unrelated to that filename can disappear through the same path.

Required improvement: distinguish compiler diagnostics from an unavailable/failed checker
and emit a bounded, deduplicated notice. Acceptance must cover missing compiler, timeout,
invalid configuration and non-file diagnostics. Hook silence must not imply a typecheck passed.

### H10 — Hook tests inherit live home and temporary state

[helpers.mjs](../scripts/hooks/__tests__/helpers.mjs), lines 19–49, inherits HOME/TMPDIR.
[session-gates.test.mjs](../scripts/hooks/__tests__/session-gates.test.mjs), line 172,
unconditionally removes the fixed `claude-council-gate-nosession` marker; other reviewed
fixtures generally use unique process/time IDs. The initial broad suite used these defaults.
Without a pre-run inventory, this audit cannot establish whether existing state was altered.

Required improvement: isolate HOME/TMPDIR and all marker/session state for the whole suite
by default. Acceptance must preseed an external sentinel and prove it remains unchanged
after successful, failed and interrupted test runs.

### S1 — Reference guidance contradicts compact/manual routing

[CLAUDE.md](../CLAUDE.md), lines 54–61, and the native contract correctly require selected
reference loading. But [auto-skills.md](../rules-library/common/auto-skills.md), lines 8–17,
and [docs/AGENTS.md](AGENTS.md), lines 205–218, still promise automatic application and
silent multi-agent engagement. Twenty-five skill descriptions promise automatic firing
while their source frontmatter disables model invocation.
[council-maintenance](../skills/council-maintenance/SKILL.md) also describes a nonexistent
skill `paths:` gate and the former full always-on rule layout. Its statement equating a
fired signal with nonconformity conflicts with its own warning that signals are not proof.

Required improvement: reconcile reference wording, descriptions, counts and installer
messages with the compact/manual contract. Preserve targeted specialist use and required
checks without introducing automatic fan-out. Claude's documented
`disable-model-invocation: true` prevents automatic invocation; custom skill `paths:` keys
do not establish that behavior. [Claude skill reference](https://code.claude.com/docs/en/skills).

Acceptance should test routing and conflicting-reference scenarios in both runtimes,
including the distinction between an observation and a verified defect.

### S2 — Large skill entrypoints weaken progressive disclosure

Eighteen entrypoint bodies exceed 500 lines: `clickhouse-io`, `clinical-data-patterns`,
`cost-aware-llm-pipeline`, `council-protocol`, `dart-flutter-patterns`, `deployment-patterns`,
`e2e-testing`, `fine-tuning-workflows`, `golang-testing`, `hipaa-compliance`, `hiring-process`,
`lean-manufacturing`, `six-sigma`, `soc2-readiness`, `springboot-testing`, `stock-broker`,
`tdd-workflow` and `triz-patterns`. Twenty-five entrypoints exceed 20,000 bytes without a
supporting references directory. The largest remain within their declared 25 KB caps;
that does not make loading several of them inexpensive.

Required improvement: keep decisions/procedure in the entrypoint and move detailed
examples/catalogs into linked references. Start with the largest and frequently invoked
skills. Verify references remain installed and discoverable in both runtimes. Measure
representative task context and completion before/after, not just file bytes. Claude also
recommends short entrypoints and progressive disclosure.
[Claude skill reference](https://code.claude.com/docs/en/skills).

### S3 — Behavioral evaluation is incomplete

[test_sdlc_skills.py](../tests/codex/test_sdlc_skills.py), lines 115–129, checks scenario
structure and coverage, not the correctness of generated advice. Prior bounded evaluation
covered ten new skills and three routing controls, not all 130 skills in both runtimes.
Its recorded entrepreneur retest still overstates absent demand and mixes renewal actions
into a two-week pilot despite specifying a later checkpoint. The CISA scenario's bounded
conclusions passed; that is evidence for that scenario, not universal audit competence.

Required improvement: add a risk-based behavioral acceptance matrix with reproducible
inputs and explicit rubric checks for arithmetic, uncertainty, timeline consistency,
authorization, evidence quality and scope. Retest the entrepreneur failure first, then
security/compliance and frequently used engineering skills. Distinguish live model
evaluation from fixture/install checks and record model/runtime versions.

### I1 — Context migration omits new skills' supporting resources

[bootstrap/context.py](../bootstrap/context.py), lines 121–160, includes all entrypoints
but only selected supporting trees. An empty-home payload omitted 452 tracked skill
subassets, including entrepreneur economics and CISA sampling references. The migrator
is not a full installer, but adding new entrypoints to an older home can create dangling
references. All current installed resources are present, so this is not today's missing-file bug.

The active Claude context manifest manages 120 skill entrypoints; the ten newly installed
skills are available but outside that migration manifest. A fresh read-only migration
dry run stopped at the customized `rules/common/no-bloat.md` with exit 1. This correctly
preserves customization; it is not a successful migration or a reason to overwrite the file.

Required improvement: include required tracked references when adding/upgrading a skill,
and provide explicit ownership/reconciliation for selective installs. Acceptance must cover
empty/older homes, customized resources, dry-run collisions, rollback and both profiles.

### Q1 — Citation verifier overstates what it validates

[verify-standards-citations.sh](../tests/verify-standards-citations.sh), lines 70 and
140–143, accepts a bare `§1` as a citation and omits top-level agents despite its scope
comment. Its header describes three citations while the effective floor is one. A fake
skill containing only an ungrounded section marker passed; a citation-free agent was
not scanned.

Required improvement: align scope and reporting, reject known false citation forms, and
check named primary-source anchors where required. Acceptance needs fake-marker and
omitted-agent fixtures. Structural matching cannot certify source accuracy, applicability,
current standards or legal compliance; retain substantive review for those claims.

### Q2 — Size-budget coverage is incomplete

[token-budget.mjs](../scripts/token-budget.mjs), lines 171–224, checks selected extensions
and roots/depths. Twelve of 740 candidates are unmeasured; the gate intentionally succeeds
when all declaring files pass. Native Python, PowerShell, settings, plugins and runtime
hook output are outside this coverage. The eager-floor measurement is useful but is not
the whole prompt or the amount of context added after each tool event.

Required improvement: define explicit coverage/exemptions, report mandatory unmeasured
files separately, and include native hook/output and selected-skill aggregate measurements.
Do not present byte estimates as measured tokens or load the library to measure it.

### H11 — Stop-gate evidence misses edits to tracked files, committed work and workspace roots

Found 2026-10-05 from the owner's live report ("plan and doc update works every time for
Codex but not every time for Claude"). Codex's adapter injects the plan reminder
unconditionally from its root registry at SessionStart/PreCompact/Stop, so it cannot
miss. Claude's docs-sync-gate must PROVE code changed, and three proof paths failed:

1. `git-state.dirtyFiles` fed porcelain lines through `lines()`, which TRIMS before
   `slice(3)`: an unstaged tracked modification (space-M-space `app.py`) became `pp.py`, whose mtime
   is 0, so EDITS to tracked files — the normal mid-task state — carried no evidence.
   Only new `??` files (no leading space) ever tripped the gate, which is exactly the
   "works sometimes" symptom. Reproduced with a fixture probe on both live and source.
2. A session that commits before Stop presents a clean tree; `git status` alone forgot
   the work. Disciplined sessions were the least likely to be reminded.
3. A multi-repo workspace root (cwd without `.git`) consulted no child repository.

Fixed in source: `dirtyFiles` parses `--porcelain -z` (NUL-separated, rename origins
skipped, spaces survive); new `commitsSince` (last 50 commits, committer-time filtered,
same-second inclusive) and `changedSince` (own repo, or up to 24 immediate child repos)
feed the gate's `codeEvidence`, with the session marker kept as the no-git backstop.
Six red-first tests in `docs-sync-evidence.test.mjs`; probes A/B/C now block on source
and remain silent on the live copy until installation. Pre-existing, left to the owner:
`sonarjs/no-os-command-from-path` on the shared `git` spawn (repo-wide convention).
Owner chose immediate installation: the four-file closure (gate, marker writer,
git-state, private-state) was backed up and installed into the live Claude home on
2026-10-05 and verified there — probes A/B/C block, marker write/read round-trips,
commit-gate and pre-push-gate smoke exit 0. Markers remain under `os.tmpdir()`
(namespaced, private) and are now only the no-git fallback; shared libs
project-context/memory-lint were already identical.

### H12 — Per-request Council activation was removed, not replaced

Found 2026-10-06 from the owner's live report ("for each request the council is not
triggered on both claude and codex. I would have to mention the council"). Three
layers, each verified live:

1. The Claude per-request trigger was gone: live `UserPromptSubmit` had NO hooks.
   `bootstrap/context.py` actively STRIPPED the legacy improve-prompt.py registration
   (it injected ~960 tokens on every prompt including task notifications), and nothing
   replaced it — the de-registration silently removed the only per-request activation.
2. Both routers were conditional/reference-shaped: `CLAUDE.md` opened with "the
   default is focused work ... not a meeting of every division" (reads as suppression)
   and the Codex `AGENTS.md` said "use the Council workflow for substantive
   implementation" — a model triages most requests out of "substantive".
3. Codex has no per-prompt event, so its only per-request lever is the always-in-context
   router text plus the SessionStart injection, neither of which stated default-on.

Fixed and installed live 2026-10-06 (backups `backups/20261006-council-default-on/`):
a slim injector (one bounded ~700-byte activation on real prompts; silent on `/` `#`
`*`, short acknowledgements, system-generated turns; every path exits 0), canonical
`settings.json` registration, `context.py` owns UserPromptSubmit in `lifecycle_hooks`
(legacy registrations replaced, personal prompt hooks preserved — the strip-block is
gone), default-on openings in both routers, and the Codex SessionStart message states
it. Verified: installer tests red under the regression mutant; live injector fires on
a real prompt and stays silent on an acknowledgement; live Codex dispatcher emits the
default-on line; a live `claude -p` probe answered "Council default mode (adaptive,
main-session)" to a prompt that never named the Council. One probe is bounded
behavioral evidence, not a guarantee the model honors the mode on every request.

### M1 — Marketing and SEO coverage

Entrepreneur, strategy-reviewer, comms-reviewer and communication-patterns cover parts of
positioning and messaging. They do not define a complete marketing strategy or content
campaign workflow. No dedicated SEO skill was found; current SEO references mainly cover
Lighthouse assertions and HTML/accessibility/performance guidance. A passing Lighthouse
check does not establish crawl/indexing status or search performance.

Required improvement: add compact marketing-strategy, seo and content-campaigns skills.
Route technical/content details on demand; reuse research, experimentation and claims
review rather than duplicating them. SEO decisions should reference primary search-engine
documentation and distinguish observed problems from hypotheses. See the
[Google SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide).
Acceptance: both runtime payloads retain procedures/references without expanding compact
discovery; realistic briefs test scope, evidence, arithmetic, attribution and publication
boundaries. Install checks alone do not prove the quality of model-generated campaigns.

### D1 — Creative coverage and aesthetic prescriptions

Product UI/UX coverage is substantial: frontend patterns, design systems, interaction
design, UX research, design thinking and accessibility. BRAG provides short launch videos,
posters and share copy. Broader brand identity, art direction and coordinated campaign
assets lack an explicit task workflow.

[visual-design-quality.md](../skills/frontend-patterns/references/visual-design-quality.md)
bans Inter, Roboto, Arial and system fonts and asserts palette superiority without context.
[design-systems core patterns](../skills/design-systems/references/core-patterns.md)
mandate light and dark themes and named product aesthetics. These are source instruction
quality findings; no generated UI regression is claimed.

Required improvement: add brand-creative-direction; ground typography, composition,
imagery, motion and production choices in the brief, audience and existing brand. Refine
existing instructions to permit appropriate familiar fonts/layouts and requested themes.
Extend BRAG for requested campaign variants with coherent identity, captions, rights and
format-specific visual verification. Acceptance includes a constrained existing-brand
brief and a fresh identity brief; evaluate readability, accessibility, consistency and
deliverable fitness instead of novelty alone.

## Remediation status — cumulative implementation

All IDs below have source changes and corresponding verification. This closes the
reported source defects within their acceptance boundaries; it does not certify every
possible command, model output, deployment or live integration.

| Finding | Implemented change and evidence | Boundary |
| --- | --- | --- |
| H1 | Scan executable invocations, literal wrappers, substitutions and heredocs; command-security regressions | Bounded static inspection, not a shell sandbox |
| H2 | Per-invocation push authorization and ordered flags, including cancelled dry-run; negative fixtures | No real fixture push |
| H3 | Credential redaction, private atomic persistence, audit bounds and session-summary TTL; concurrent writer/redaction controls | Existing live logs were not rewritten |
| H4 | Explicit terminal exit, exact check modes, coverage and source/index/repository fingerprints; failed attempts invalidate proof | Dynamic project-script semantics remain unknown |
| H5 | All affected marker writers use validated private session state with atomic writes; symlink/collision controls | Private fixture behavior, not trusted live hooks |
| H6 | Native Go advisory and independent failed-tool feedback both survive; positive/negative feedback tests | Native adapter event surface remains intentionally smaller |
| H7 | Classifier excludes directory-name intent and retains explicit task/model intent; regression fixtures | Heuristic advice cannot switch the runtime's main model |
| H8 | Bounded native error text and explicit registration/subprocess timeouts; oversize/escaped/timeout controls | No diagnosis of every cause of live compaction thrashing |
| H9 | Missing tools and typecheck failures emit bounded feedback; positive strict compiler fixtures | Repository tool configuration still determines coverage |
| H10 | Isolated HOME/TMP harness and sentinel/interruption tests; pinned positive formatter/compiler tools | Missing packages are unavailable, never passing |
| S1 | Compact/manual routing contracts aligned in rules, skills and runtime docs; payload/source checks | Claude automatic triggers are not Codex capabilities |
| S2 | Large entrypoints split into conditional references; budget and catalog checks cover supporting files | Referenced content still consumes context when loaded |
| S3 | Frozen behavioral scenarios, actual Claude/native Codex drafts, retained failures, targeted retests and manual grading | Bounded advice trials, not universal reliability or blinded evaluation |
| I1 | Supporting resources included in owned context migration; empty-home install/uninstall and collision/no-mutation controls | Personal live-home collisions/customizations preserved |
| Q1 | Named-citation gate described as presence-only; negative missing/bare-section/external-reference cases | Does not validate source correctness or compliance |
| Q2 | Every candidate has an explicit budget; malformed/null/empty/duplicate paths stay eager; cap-negative controls | Bytes/4 is an estimate, not billed tokens |
| M1 | Marketing strategy, SEO and content campaign procedures, catalog/profile/Claude-transform tests and realistic briefs | No campaign publication, spending or indexing claim |
| D1 | Brand/creative procedure and contextual fonts/themes; bounded identity/media advice evaluation | Actual asset rendering and accessibility inspection still required per deliverable |
| QA1 | Test commands/fixtures fail on real failed checks across reviewed language examples | Samples do not install project frameworks |
| QA2 | Risk-based coverage distinguishes percentage from behavior and avoids blanket unsupported mandates | Repository-required checks remain required |
| QA3 | E2E readiness and browser selection fit actual user journeys; source contract checks | No unrelated product browser run |
| QA4 | Explicit independent assertions and meaningful negative controls replace vacuous examples | A test passing proves only its inspected assertions |
| QA5 | Retired/conflicting artifacts reconciled with active guidance; source contract tests | Historical evidence remains explicitly historical |
| QA6 | CI uses required pinned compiler/formatter tools and positive fixtures; actionlint and local tool tests | Local checks are not a hosted CI run |
| AD1 | Plain EXPLAIN default, explicit execution/isolation boundary, rollback limits; agent contracts | No unsafe production query execution |
| AD2 | AI/domain authority cannot waive security or merge blockers; normalized decision contracts | Advice evaluation does not enforce repository branch protection |
| AD3 | Provider-specific raw-body HMAC/signature guidance replaces generic false equivalence | Real provider integrations need their own contract tests |
| AD4 | IRS/FinCEN roles and applicability corrected with named primary references | Version/applicability-dependent, not legal certification |
| AD5 | Health retention and ONC applicability separated from universal HIPAA claims | No clinical deployment audited |
| AD6 | Education privacy and FDA/COPPA applicability separated by actual product/use | No blanket regulated-product assumption |
| AD7 | Dependency audit thresholds and unfixable findings handled without arbitrary waiver | Local policy and vulnerability context still matter |
| AD8 | Specialist severities/actions normalize to one merge contract; no invented defects or metric claims | Required unavailable evidence can block without inventing a defect |
| LS1 | C++ containment handles sibling/symlink escapes; actual compiled negative fixtures | Mutable-tree TOCTOU requires its own operating model |
| LS2 | Swift persistence keeps memory/disk coherent across failed save/delete and corrupt/duplicate load | Actual strict Swift compilation and local faults, not device durability |
| LS3 | Transactional outbox, lost-ack retry and consumer deduplication examples; independent effect assertions | Local protocol tests do not certify AWS/provider exactly-once behavior |
| LS4 | Durable payment intent before gateway effect, idempotent recovery and notification outbox; concurrent/fault fixtures | Extracted protocol exercised with private SQLite, not live Django/payment credentials |
| LS5 | False/null/malformed/transport RPC results propagate failure; strict TypeScript fixtures and SQL rollback controls | No remote Supabase product run |
| LS6 | Server-authorized tenant context, runtime-role/FORCE RLS, missing context and pool reuse; private PostgreSQL faults | Supabase auth.uid() example scoped to compatible trusted authentication |
| LS7 | Framework-supported hash defaults and upgrade guidance corrected; source contract tests | Framework/version-specific configuration still needs project verification |
| LS8 | Bounded DDL, fast-default/validation and race-safe backfill guidance; real lock/dual-write controls | Fixture timing is not a production migration benchmark |

Final independent review exposed two further counterexamples within H4/Q2: `env -C`
and sudo directory-changing wrappers could credit checks to the wrong repository, and
malformed scope lists such as `[null]` could disappear from eager context estimates.
Both were fixed. An actual child process proves the first command ran in another
repository; its result cannot create verification proof for the original repository.
Twelve malformed-scope controls remain eager and fail an intentionally low cap.

Important limits remain explicit:

- Command parsing has a depth bound of 24. Dynamic aliases, sourced/downloaded code,
  unknown interpreter bodies and arbitrary script semantics remain outside static proof.
- Pre-push documentation evidence covers the selected repository HEAD. It does not
  certify every commit in an arbitrary unpushed multi-commit range.
- Oversized pre-existing audit files and stale locks produce bounded notices; live logs
  and personal runtime settings were not automatically repaired or replaced.
- Source-fed model drafts assess advice, not installed slash-command/hook activation.
  Private Codex discovery verifies availability without changing trust or running hooks.
- Citation presence and reference inventories do not establish current legal applicability,
  every source's accuracy, or complete model reliability.

The [marketing evaluation](MARKETING-CREATIVE-EVALUATION.md) records the original bounded
brief review. The [behavioral receipt](../tests/skills/evidence/2026-10-05/README.md)
retains actual drafts, failed attempts, source provenance, grading and runtime limits.
The authoritative plan retains the worktree and next-action handoff.

## First-batch verification receipts — historical baseline

| Check | Terminal result | Limitation |
| --- | --- | --- |
| Full isolated Node hook suite | Exit 0; 1,111 passed, zero failed/skipped | Serialized hook fixtures, not live-runtime certification |
| Classification/marker follow-up | Exit 0; 133 passed | Exact-mode, information-only, preparation and credential regressions |
| Codex Python suite | Exit 0; 74 total, 73 passed, one optional runtime-discovery skip | Isolated installer/fixture checks |
| New procedure payload follow-up | Exit 0; three tests passed | Both Codex profiles and Claude compact transform; no live installation |
| Strict JavaScript lint | Exit 0; all 26 changed JS/MJS files, zero warnings | Existing strict ESLint profile; no new suppressions |
| Python lint | Exit 0; Ruff E/F/I/B/UP for the new test module | No claim of an all-rules Ruff pass |
| Skill metadata | Exit 0 for all four new entrypoints | Structural validity |
| Source size gate | Exit 0; 739 of 751 declare budgets; 20,023-byte eager floor | Twelve unmeasured candidates; Q2 remains open |
| Repository links | Exit 0; 1,722 links across 904 Markdown files | Internal resolution only |
| Documentation lint | Exit 0; 903 Markdown files, zero findings after the audit refresh | Formatting only |
| Independent final recheck | Exit 0; eight negative and four positive classification assertions passed | Reported examples only; unknown flags remain a static-analysis limit |

The first isolated full Node run failed three legacy formatter/typecheck tests because
they relied on npm downloads or a personal cache (1,080 passed, three failed, two skipped).
Local package dispatch and explicit missing-tool fixtures removed that dependency; later
full runs passed. Missing-tool cases always execute. Without local packages, positive tool
checks are reported as skipped rather than passed. The test command uses
`COUNCIL_TEST_NODE_MODULES=/tmp/council-context-lint-tools/node_modules` for this receipt.

Evidence logs are `/tmp/council-remediation-*.log`. The final source checks and documentation
receipts are also retained in the authoritative plan; temporary logs may expire.

## Neutral branding completion — 2026-10-05

The product is now **The Council**, with canonical repository
[Nmor/the-council](https://github.com/Nmor/the-council) and renamed
[le-yanu/the-council fork](https://github.com/le-yanu/the-council). GitHub names,
parent relationship, descriptions, homepage and local remotes were verified after
renaming. The local worktree remains `/Users/APPLE/claude-council` to preserve active
sessions and plan mappings; runtime paths and compatibility identifiers are retained.

README, architecture, setup, security, contribution and runtime documentation now
present Claude Code and Codex explicitly. Installer messages describe the Claude
installation accurately and direct Codex users to its native adapter. Issue reports
identify the affected runtime; IDE display names and repository links use the new
brand. A bounded independent review found a Windows setup prerequisite gap and a
stale full-profile skill count; both were corrected. Neither correction establishes
Windows runtime behavior or live hook activation.

Fresh checks passed: 73 Codex Python tests with one optional native-discovery skip,
903 Markdown files, 1,681 internal links across 904 files, 725 orphan candidates,
21 Claude source structural checks, the changed Bash installer's ShellCheck warning
threshold and the source budget gate. All three installer previews exited zero in
private temporary locations without writing destination state. Seven PowerShell
installer/example sources parsed successfully; four YAML and two JSONC configurations
parsed, including issue-form ID/runtime checks. The reviewer parsed all five changed
JetBrains XML templates. Source changes remain uncommitted and unpushed; no live
installation, trust change or model call was performed in this branding batch.

This completes the naming task. S1–S3 and the other open audit findings above retain
their acceptance criteria; neutral branding is not proof of behavioral remediation.
The existing authoritative plan records the worktree, unchanged HEAD and next action.

## Initial audit verification receipts

| Check | Terminal result | Limitation |
| --- | --- | --- |
| Node hook tests | Exit 0; 969 total, 967 passed, two skipped | H10 environment isolation gap |
| Codex Python tests | Exit 0; 71 total, one optional runtime test skipped | Structural/fixture verification |
| Source size gate | Exit 0; 728 of 740 declare budgets; 20,023-byte floor | Q2 scope limits |
| Native install verifier | Exit 0; integrity passed for 1,054 files | Output explicitly says runtime not checked |
| Claude migration dry run | Exit 1 at customized `no-bloat.md` | Preservation collision; not migration success |
| Targeted defect probes | Expected block/allow differences captured | Serialized/temporary fixtures, not live actions |
| Prior native discovery test | Exit 0; one test | Reused unchanged-source evidence; no model call or trust bypass |
| Report Markdown lint | Exit 0; 898 files, zero findings | Formatting, not behavioral correctness |
| Repository link integrity | Exit 0; 1,691 links across 899 files | Internal link resolution |

Fresh logs and inventories are under `/tmp/council-audit-*-20261005.*`. The independent
hook evidence is `/tmp/council-hook-audit-20261005.evidence.json`. Prior scenario evidence
is `/tmp/council-sdlc-evaluation-20261005.json`; prior native discovery evidence is
`/tmp/council-sdlc-native-discovery.log`. Temporary artifacts may expire; this report records
the important triggers, results and acceptance criteria durably.

## Focused QA and testing review — 2026-10-05

Status: **review complete; the six new QA findings remain unimplemented**. This review
covered test strategy, acceptance criteria, TDD, coverage, verification, evaluation and
E2E entrypoints; targeted Python, Go, C++, Django, Spring Boot and Swift guidance; testing
rules, two specialist agents, CI and native-adapter tests. Searches preceded bounded
manual reads. It does not certify every supporting example, compiler or model response.

The worktree and HEAD above are unchanged. Only this report, the existing plan and the
README banner were edited in this review. Existing remediation changes remain intact.
The committed README still contained the pasted “The Claude Council” banner; the local
neutral rewrite had removed it. The source now explicitly displays **The Council** in
the banner and identifies both Claude Code and Codex immediately below it. No push,
installation, trust change, live hook or new model evaluation occurred.

### Existing strengths to retain

- `skills/test-strategy/SKILL.md` and `skills/requirements-acceptance/SKILL.md` already
  select tests by failure risk, require independent oracles and distinguish durable
  effects from HTTP success. They address uncertain writes, retries, cancellation,
  concurrency, realistic replay provenance and nondeterministic sampling limits.
- Language guidance already includes fixtures, error paths, dependency injection,
  property testing, race/fuzz checks and framework-specific verification. These are
  useful procedures; this audit did not execute every language example.
- The E2E agent already requires isolation, state-based waits and a quarantine ticket
  with a fix-by date. Accessibility guidance includes manual keyboard/screen-reader
  checks; performance expertise exists. These capabilities are not wholly missing.
- H4 now has meaningful regressions for failed/running commands, masking, invalid
  coverage and stale source. Payload fixtures establish hook contracts; live payload
  compatibility and model behavior require separate evidence.

### New findings and acceptance criteria

| ID | Priority | Finding | Evidence |
| --- | --- | --- | --- |
| QA1 | P2 | Verification examples return success after tool failure | Five exact command probes |
| QA2 | P2 | Coverage requirements and test selection contradict each other | Cross-file source review |
| QA3 | P2 | E2E browser/readiness rules are incorrect or too broad | Source and official Playwright guidance |
| QA4 | P2 | An error-path test has no operation or assertion | Source-confirmed vacuous example |
| QA5 | P2 | The E2E command copies a retired artifact action | Source and GitHub retirement notice |
| QA6 | P2 | Ordinary CI skips five positive formatter/compiler tests | Independent isolated skip probe |

#### QA1 — Verification instructions can hide failed checks

`skills/verification-loop/SKILL.md:28`, `:51` and `:61` pipe build, lint and test output
through `tail`/`head` without preserving the producer's status. The evaluation examples
at `skills/eval-harness/SKILL.md:73` and `:76` finish with a successful `echo "FAIL"`
when the check fails. These are documented examples, not a newly demonstrated bypass
of the remediated H4 gate.

Private probes ran all five exact documented npm commands against a fake npm returning
7. **Every wrapper returned 0**; the unwrapped command and a `pipefail` control returned
7. The probe itself exited 0 because it correctly detected those failures being masked.
No npm package was installed and no real build, hook or repository test was executed.
`commands/verify.md:53` also offers `Secrets: OK` without requiring a corresponding
scan in every mode or allowing an explicit unavailable/not-run state.

Acceptance: preserve the checked process's result while bounding displayed output;
make failing graders exit nonzero. Test passing, failing, interrupted, unavailable and
running results. Report each command, revision, completed exit status and boundary;
do not emit a passing security/coverage claim for a skipped check. Reuse H4 rather than
introducing a second verification policy.

#### QA2 — Coverage policy disagrees with its procedures and metrics

`rules-library/common/testing.md:14` requires 90% touched-file, 80% project and 95%
critical-path coverage, while `skills/tdd-workflow/SKILL.md:29`,
`skills/verification-loop/SKILL.md:64` and several language rules still prescribe 70%.
The TDD skill itself later calls that target stale. Spring Boot's checklist requires
80% line but 75% branch coverage (`skills/springboot-testing/SKILL.md:516`), conflicting
with the common 80% branch floor. Go guidance mixes general-code 70% and touched 90%.

`commands/test-coverage.md:28` searches only for files below 80%; its green example ends
with auth at 88% and another changed file at 82%. Neither meets the stated touched-file
floor, and the auth result is below the stated critical-path threshold. The common
“ALL required” test-type heading also conflicts with the compact strategy's risk-based
selection and some conditional bullets beneath that heading.

Metrics cannot be silently interchanged: native Go coverage computes approximate
basic-block information and does not probe inside `&&`/`||`, so its percentage alone
does not establish the separately promised branch threshold.
[Official Go coverage documentation](https://pkg.go.dev/cmd/cover).

Acceptance: define a single policy with repository/user precedence, explicit risk and
language-specific metrics. Align entrypoint descriptions, checklists, commands and
worked examples. Distinguish project, changed-file and critical-path denominators;
fail a below-threshold fixture and report unsupported metrics honestly. Choose test
types by the affected failure boundary instead of requiring all types for every change.
Coverage should support, not replace, behavioral and durable-state assertions.

#### QA3 — E2E readiness and browser selection need correction

`skills/e2e-testing/SKILL.md:144` makes `networkidle` mandatory after every transition
and calls normal locator auto-waiting forbidden. Playwright explicitly discourages
`networkidle` for testing and recommends web assertions for readiness. The skill's
5–15% flake claim has no supporting measurement in the reviewed procedure.
[Playwright Page reference](https://playwright.dev/docs/api/class-page#page-wait-for-load-state).

At `skills/e2e-testing/SKILL.md:171`, static pages are categorically excluded from
browser checks. HTML parsing cannot establish rendered layout, keyboard focus or
visual behavior; whether a browser is needed depends on the acceptance criterion.

Acceptance: use locator actions, web-first assertions and specific application-state
or response waits. Cover a background-polling page and delayed hydration without a
blanket idle wait. Preserve separate visual/accessibility checks where rendering or
interaction matters, including static pages. Remove unsupported flake percentages
and synchronize the command and agent guidance with the same readiness rules.

#### QA4 — The TDD example's error test can pass without testing errors

`skills/tdd-workflow/SKILL.md:188` creates a request but never calls `GET`, injects a
database failure or asserts a result. It therefore does not test the behavior named
“handles database errors gracefully.” Other examples correctly call and assert the
handler; the finding concerns this incomplete worked example, not all TDD guidance.
`commands/test-coverage.md:47` also defaults to mocking every external dependency
without explaining when a real integration/transaction test remains necessary.

Acceptance: complete the example or clearly label it non-executable pseudocode.
Require an actual fault, operation and observable error outcome. Show unit mocking
separately from contract/transaction tests that establish durable effects. A deliberate
implementation mutation that suppresses the error or loses the write must make the
relevant example test fail. Avoid tests that only copy implementation calculations.

#### QA5 — The copied E2E workflow uses a retired action

`commands/e2e.md:289` uses `actions/upload-artifact@v3`; the E2E skill uses a different
version. GitHub retired v3 on GitHub.com on January 30, 2025, so copying the command's
example can fail its artifact step. This is a documentation defect, not evidence that
the Council repository's own workflow uses that retired action. The retirement notice
explicitly excludes existing GitHub Enterprise Server versions.
[GitHub artifact-action retirement notice](https://github.blog/changelog/2024-04-16-deprecation-notice-v3-of-the-artifact-actions/).

Acceptance: use an action supported by the target GitHub platform and runner, apply
the repository's dependency-pinning policy and keep both examples synchronized.
Validate the copied YAML and the upload path/retention behavior; record whether an
actual hosted run was performed rather than treating YAML parsing as execution.

#### QA6 — Test isolation left positive tool coverage disconnected from CI

`.github/workflows/ci.yml:236` runs Node tests without `COUNCIL_TEST_NODE_MODULES`.
`scripts/hooks/__tests__/post-edit-tools.mjs:7` then marks Prettier and TypeScript
unavailable. Five ordinary skip-capable cases in `post-edit.test.mjs:87`, `:158`,
`:183`, `:191` and `:197` do not execute. An independent focused probe exited 0 with
**zero passed, zero failed and five skipped**. There is no required-test skip guard
in the reviewed job. The isolated fixture design correctly removes personal-cache
dependence; CI has not supplied its positive-tool prerequisites.

Acceptance: provision pinned local tool fixtures in CI, set the path explicitly and
require these positive formatting/compiler tests to execute and pass. Fail a fixture
where a required tool is absent; retain separate missing-tool tests. Verify in private
state so installing fixtures does not reintroduce H10's live-home dependence.

### Existing findings strengthened by this review

- **S3 — Behavioral evaluation:** the four SDLC tests check metadata, copied content,
  wrapper targets and scenario structure (`tests/codex/test_sdlc_skills.py:43–124`).
  An independent in-memory mutation changed mocked responses into sufficient proof
  of downstream effects and transcript replay into proof of audio delivery. All four
  tests still passed. This demonstrates the structural suite's limit; it does not
  establish that the current skill gave that wrong answer in a real model session.
  Add independently scored scenario outputs and deliberate wrong-guidance controls.
  Capture runtime, model, revision, prompt, response and acceptance rubric for both
  Claude and Codex, with repeat/sampling limits for nondeterministic results.
- **S1/S2 — Routing and context:** QA entrypoints still contain Claude-only descriptions
  and mandatory-delegation wording. TDD, E2E and Go entrypoints are 605, 627 and 851
  lines. Keep a compact shared workflow, load language/examples on demand, and align
  both runtimes without claiming Claude triggers run natively in Codex.
- **Native integration boundary:** `tests/codex/test_runtime.py:18` is optional unless
  `COUNCIL_CODEX_BIN` is supplied; ordinary CI does not supply it. When enabled, it
  exercises compact discovery and untrusted registration, not full-profile discovery,
  a model turn or executed hooks. Add a separately reported, versioned integration
  check for both profiles. Do not weaken trust or conflate it with behavior evaluation.
- **E2E evidence handling:** retries, skips and quarantine already exist; align examples
  with the agent's owner/fix-by requirement and report first-attempt failures. Define
  safe fixture data, authentication-state handling and artifact access/retention before
  using automatic screenshots/videos/traces. No real artifact exposure was established.

### QA review evidence and implementation sequence

| Check | Observed result | What it establishes |
| --- | --- | --- |
| Five documented npm failure probes | Probe exit 0; underlying 7, wrappers all 0; controls 7 | QA1 reproduced in private state |
| Independent wrong-guidance mutation | Probe exit 0; four SDLC tests passed | S3 behavioral grading gap |
| Independent absent-tool probe | Exit 0; zero passed, five skipped | QA6 CI prerequisite gap |
| Prior unchanged-source Python suite | Reused: 73 passed, one optional discovery skip | Adapter fixtures, not model quality |
| Documentation lint | Exit 0; 903 files, zero errors | Report and README formatting |
| Link integrity | Exit 0; 1,684 links across 904 files | In-repository link resolution |
| Diff whitespace check | Exit 0 | Existing tracked changes have no whitespace errors |

Primary command evidence is `/tmp/council-qa-review-20261005.json`; independent receipts
are summarized above and in the authoritative plan. The independent reviewer retained
no separate mutation/skip files; those receipts were reported from completed tool calls.
The skip probe was:

```bash
env -u COUNCIL_TEST_NODE_MODULES node --test \
  --test-name-pattern='rewrites a JavaScript|says nothing on stderr when it formats|reports the type error|broken file is a different one|edited TypeScript file type-checks clean' \
  scripts/hooks/__tests__/post-edit.test.mjs
```

Temporary artifacts may expire.
No new passing full-suite, compiler, hosted-CI or model-behavior result is claimed.
Documentation receipts are `/tmp/council-qa-markdown-20261005.log` and
`/tmp/council-qa-links-20261005.log`.

Implement QA1 and QA6 first so failures remain visible and CI exercises its required
tools. Then reconcile QA2 with the compact strategy, fix QA3/QA4/QA5 examples and
extend S3 with independent rubrics. Split entrypoints through S2 and verify native
profiles separately. The current task reviewed these changes; it did not implement
or install the six QA fixes.

## Agents, divisions and language-stack review — 2026-10-05

This supplement reviews instruction quality, responsibilities, routing, safety, error
handling and verification. It adds **AD1–AD8 and LS1–LS8**, all open. It does not
implement these fixes. Worktree and HEAD remain those recorded above; pre-existing
uncommitted work was preserved. This batch changes this audit and the authoritative
plan only. Private reproduction programs are temporary evidence, outside the repository.

### Coverage and limits

All **39 unique agents and 16 divisions** were reviewed by one bounded independent
Council code reviewer. `doc-updater` belongs to two divisions: 40 memberships are not
40 unique agents. The main session inventoried all **134 skill entrypoints** and
**18 language directories / 100 rule files**, then reviewed the language and stack
procedures through routing, error/security/test guidance and targeted examples.
Inventory and static review do not certify every example or model response.

| Division | Agents reviewed | Assessment / finding |
| --- | --- | --- |
| 1 Architecture & Planning | architect, planner | Responsibilities present; S1 orchestration conflict retained |
| 2 Implementation & Build | build-error-resolver, go-build-resolver, python-build-resolver, rust-build-resolver, java-build-resolver, dotnet-build-resolver, ruby-build-resolver, php-build-resolver, swift-build-resolver, refactor-cleaner, database-reviewer, infra-reviewer | Build ownership present; AD1 unsafe profiling |
| 3 Quality & Review | code-reviewer, go-reviewer, python-reviewer, java-reviewer, mobile-reviewer, doc-updater | Language review present; AD8 severity/authority conflict |
| 4 Security | security-reviewer | AD7 dependency threshold mismatch |
| 5 Testing & QA | tdd-guide, e2e-runner, performance-reviewer | AD1 and existing QA1–QA6 |
| 6 Compliance & Legal | compliance-reviewer, payments-reviewer, health-reviewer, education-reviewer | AD3–AD6 protocol, applicability and regulatory errors |
| 7 UX & Accessibility | ux-reviewer, accessibility-reviewer | Ownership present; activation claims remain S1 |
| 8 Operations | ops-reviewer | Reliability, deployment and runbook responsibilities present |
| 9 Data | data-reviewer | Governance, analytics, PII and lineage responsibilities present |
| 10 Finance | finance-reviewer | Pricing, cost and financial-impact responsibilities present |
| 11 Risk | risk-reviewer | Blast-radius review and authorized risk acceptance explicit |
| 12 Strategy | strategy-reviewer | Vendor, positioning and lifecycle responsibilities present |
| 13 People | people-reviewer | Ownership, hiring and knowledge responsibilities present |
| 14 ESG | esg-reviewer | Sustainability and carbon responsibilities present |
| 15 Responsible AI | ai-ethics-reviewer | AD2 documentation-only release loophole |
| 16 Communications | comms-reviewer, doc-updater | Communication review and documentation production present |

The language matrix records the actual files, rather than promising uniform coverage.
Most six-file sets contain coding-style, hooks, no-discards, patterns, security and
testing. HTML/CSS and Dockerfile omit no-discards; Markdown has one rule file; YAML
has no dedicated testing/no-discards file. These differences are not automatically
defects. `docs/RULES.md:161` should describe them accurately during S1/S2 reconciliation.

| Language / surface | Rule files | Core skills considered | Evidence boundary |
| --- | ---: | --- | --- |
| Bash | 6 | bash-scripting-patterns | Static guidance; QA1 failure visibility reused |
| C++ | 6 | cpp-coding-standards, cpp-testing | LS1 compiled and executed |
| C# / .NET | 6 | csharp-patterns | Static guidance; no .NET build |
| Dart / Flutter | 6 | dart-flutter-patterns | Static guidance; no Flutter build |
| Dockerfile | 5 | dockerfile-patterns | Static guidance; no image build |
| Go | 6 | golang-patterns, golang-testing | Static guidance; no new Go suite |
| HTML/CSS | 5 | frontend-patterns | Static guidance; no rendered UI evaluation |
| Java | 6 | java-coding-standards, jpa-patterns | Static guidance; no JVM build |
| Kotlin | 6 | kotlin-patterns | Static guidance; no Kotlin build |
| Lua | 6 | lua-patterns | Static guidance; no Lua execution |
| Markdown | 1 | markdown-style | Report formatting/link checks below |
| Python | 6 | python-patterns, python-testing | Django payment method extracted for LS4 fixture |
| Ruby / Rails | 6 | ruby-rails-patterns | LS7 checked against official Devise source; no Rails run |
| Rust | 6 | rust-patterns | Static guidance; no Cargo suite |
| SQL | 6 | sql-patterns | LS6/LS8 private PostgreSQL fixture |
| Swift | 6 | swift-actor-persistence, swift-protocol-di-testing | LS2 compiled with Swift 6 strict concurrency |
| TypeScript | 7 | typescript-patterns, vue3-patterns | LS5 exact client logic in Node; no framework build |
| YAML | 4 | yaml-patterns | Static guidance; no deployed manifests |

This accounts for **24 core language/frontend skills**. Related stack review considered
`backend-patterns`, `api-design`, `django-patterns`, `django-testing`,
`springboot-patterns`, `springboot-testing`, `database-migrations`, `postgres-patterns`,
`dynamodb-patterns`, `clickhouse-io`, `aws-serverless-patterns`, `cloud-architecture`,
`network-patterns`, `datacenter-ops`, `docker-patterns`, `deployment-patterns`,
`observability-patterns`, `mcp-builder`, `mlops-patterns`, `rag-design`,
`fine-tuning-workflows`, `ml-model-selection`, `prompt-engineering`,
`cost-aware-llm-pipeline` and `eval-harness`. Framework/platform review was static
except the explicitly described fixtures. No live provider, payment, database,
deployment, training/promotion or MCP service was exercised.

### New findings

| ID | Priority | Finding | Evidence |
| --- | --- | --- | --- |
| AD1 | P1 | Review profiling instructions can execute writes | Static; PostgreSQL primary documentation |
| AD2 | P1 | Publishing documentation can clear an unresolved AI veto | Contradictory source conditions |
| AD3 | P2 | Payment webhook rules conflate provider protocols | Adyen primary documentation |
| AD4 | P2 | Payment reporting requirements are obsolete/misidentified | IRS and FinCEN primary sources |
| AD5 | P2 | Healthcare retention and regulator claims are incorrect | HHS and ONC primary sources |
| AD6 | P2 | Education review imports medical-device authority and wrong COPPA date | FDA and federal rule timetable |
| AD7 | P2 | Dependency audit command cannot enforce its stated threshold | Source and npm documentation |
| AD8 | P2 | Severity labels and merge-blocking authority disagree | Cross-agent source comparison |
| LS1 | P1 | C++ path containment accepts sibling-directory escapes | Exact example compiled/executed |
| LS2 | P1 | Swift persistence can diverge or overwrite unreadable storage | Exact actor compiled; fault/control fixtures |
| LS3 | P1 | Webhook claim-before-enqueue can permanently lose work | Offline sequence model; AWS documentation |
| LS4 | P1 | Django payment retry can charge an order twice | Extracted method; fake gateway/order faults |
| LS5 | P2 | Backend RPC resolves a failed transaction as a normal result | Exact client logic; SQL execution untested |
| LS6 | P1 | SQL tenant context persists across requests; privilege advice is wrong | Private PostgreSQL execution and documentation |
| LS7 | P2 | Framework password-hasher defaults are misstated | Django docs and official Devise source |
| LS8 | P2 | Migration guidance misstates locking and orders backfill unsafely | Private PostgreSQL execution and documentation |

#### AD1 — Database profiling must respect execution scope

`agents/database-reviewer.md:54,114` directs `EXPLAIN ANALYZE` without restricting
statements/environments; `agents/performance-reviewer.md:116` rejects unprofiled queries.
`ANALYZE` executes statements, including writes and side effects. No real database was
modified by this agent review. [PostgreSQL EXPLAIN](https://www.postgresql.org/docs/18/sql-explain.html).
Acceptance: default to plain `EXPLAIN`; execution profiling needs an authorized isolated
target, explicit side-effect analysis and rollback limitations. A write-query review
must leave production data unchanged.

#### AD2 — AI documentation is not remediation

`agents/ai-ethics-reviewer.md:50–57` joins release conditions with `OR`, allowing a
model card or accountability record to clear unresolved safety/fairness findings;
line 138 separately blocks inconclusive bias evaluation. Acceptance: verified remediation
for each finding, or a specifically authorized and legally permitted residual-risk
exception naming the risk, owner, mitigation and deadline. Model-card publication must
not independently clear a failed or inconclusive fairness evaluation.

#### AD3 — Webhook verification must follow the actual signed protocol

`agents/payments-reviewer.md:89–90` mandates verification before deserialization and a
generic five-minute timestamp window. Adyen standard webhooks put HMAC in `additionalData`
and sign selected parsed fields; `eventDate` is not in that signed-field list. Other Adyen
variants use raw-body signatures. [Adyen HMAC verification](https://docs.adyen.com/development-resources/webhooks/secure-webhooks/verify-hmac-signatures/).
Acceptance: separate providers/variants, bound parsing, preserve required raw bytes,
verify before business actions and enforce time windows only against supported
authenticated timestamps. Test official vectors, tampering and legitimate retries.

#### AD4 — Payment reporting needs current applicability and citations

`agents/payments-reviewer.md:111,210–211` states a universal $600 federal 1099-K
threshold and retains the old BOI regime/citation. Current federal TPSO reporting uses
over $20,000 **and** more than 200 transactions; payment-card reporting differs.
[IRS 1099-K guidance](https://www.irs.gov/businesses/understanding-your-form-1099-k).
FinCEN's final rule effective August 14, 2026 exempts U.S. companies; BOI reporting is
§1010.380, distinct from §1010.230. [FinCEN current BOI guidance](https://www.fincen.gov/boi).
Acceptance: date/scope requirements by jurisdiction, rail, reporting entity and exemption;
correct citations and test domestic-company, foreign-company, card and TPSO scenarios.

#### AD5 — Separate medical records, compliance evidence and device regulation

`agents/health-reviewer.md:23` assigns patient records a federal six-year minimum.
HIPAA does not prescribe medical-record retention periods; state laws generally govern
them. [HHS retention FAQ](https://www.hhs.gov/hipaa/for-professionals/faq/does-hipaa-require-covered-entities-to-keep-medical-records-for-any-period/index.html).
Line 123 labels §170.315(b)(11) an FDA rule in 21 CFR; the criterion is ONC health IT
certification in 45 CFR. [ONC decision-support interventions](https://healthit.gov/test-method/decision-support-interventions/).
Acceptance: classify the evidence/record category, applicable law and legal holds;
separate ONC certification from FDA intended-use/device classification. Test a medical
record retention case and a CDS applicability case against the correct authorities.

#### AD6 — Education applicability cannot be copied from healthcare

`agents/education-reviewer.md:98,105–107` assigns FDA/SaMD and clinical sign-off language
to AI proctoring without establishing medical-device intended use. Ordinary examination
proctoring does not establish that scope. [FDA intended-use guidance](https://www.fda.gov/medical-devices/digital-health-center-excellence/step-1-software-function-intended-medical-purpose).
Line 117 calls April 22, 2025 COPPA's effective date; publication was then, effectiveness
was June 23, 2025 and general compliance April 22, 2026, with specified exceptions.
[Federal COPPA timetable](https://www.reginfo.gov/public/do/eAgendaViewRule?RIN=3084-AB58&pubId=202504).
Acceptance: determine actual education/privacy/accessibility/discrimination applicability,
invoke medical-device authority only when supported, and distinguish the three dates.

#### AD7 — Dependency command and policy must agree

`agents/security-reviewer.md:25,47` blocks MODERATE+ vulnerabilities but uses
`npm audit --audit-level=high`, which does not fail for moderate-only findings.
[npm audit exit-status policy](https://docs.npmjs.com/cli/v11/commands/npm-audit/).
Acceptance: use the canonical threshold and test moderate-only, high, critical, clean
and unavailable-tool cases. This differs from QA1's shell wrappers hiding failures.

#### AD8 — Normalize severity before deciding whether a finding blocks merge

`agents/code-reviewer.md:226–228,287` mixes CRITICAL/HIGH/MEDIUM/LOW output with
BLOCKER/CRITICAL/MAJOR authority and permits HIGH findings with caution. Java and mobile
claim their different taxonomy is the general reviewer's format (`java-reviewer.md:49`,
`mobile-reviewer.md:73`); Go/Python block HIGH, while security's veto names BLOCKER
despite its other output labels (`security-reviewer.md:167`). Acceptance: one explicit
severity-to-action contract, or lossless normalization among supported taxonomies;
the same unresolved exploit must get the same merge decision across reviewers.

#### LS1 — String prefixes are not filesystem containment

`rules-library/cpp/security.md:123–140` and the migrated C++ security reference label
canonical-path string-prefix comparison correct. The compiled example opens
`../vault-sibling/secret.txt` outside `vault`, because the sibling shares its prefix.
The ordinary in-directory control also succeeds. Acceptance: component-aware containment,
explicit absolute/symlink/TOCTOU policy for untrusted mutable filesystems, checked stream
errors and normal/sibling/absolute/symlink regressions. No product exploit was attempted.

#### LS2 — Actor isolation does not provide durable transactions

`skills/swift-actor-persistence/references/actor-repository.md:28–58,74` changes cache
before persistence; failed save/delete leave cache changed. Read/decode errors silently
load empty storage, which the next save overwrites. All three failures reproduced;
healthy reload passed. Duplicate IDs can also trap at line 58 (static, not executed).
Acceptance: persist candidate state before publishing cache, distinguish missing files
from read/decode failures, preserve bad bytes for explicit recovery, reject/resolve
duplicates deliberately and verify the generic Sendable boundary. Test failed
save/delete, corrupt/unreadable input, duplicates and restart against durable state.

#### LS3 — Idempotency must preserve recoverable delivery intent

`skills/aws-serverless-patterns/SKILL.md:55–67,100–102` claims a DynamoDB key before
enqueueing, then short-circuits repeat claims. The offline model lost an event after
enqueue failure because its surviving claim suppressed retry. This is a sequence
simulation, not execution of an AWS handler. Acceptance: atomically retain payload and
publish intent, use a recoverable outbox/CDC or equivalent protocol, distinguish
in-progress/completed state and make consumers idempotent; test failures on both sides
of enqueue and ambiguous acknowledgments. [AWS transactional outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html).
The SQS worker example at lines 79–90 also configures an asynchronous on-failure
destination. SQS polling invokes Lambda synchronously; its failure/retry/DLQ behavior
must be configured on the correct queue/event-source path. This is static provider
scope evidence, not a deployed DLQ test. [Lambda SQS invocation](https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html),
[asynchronous destinations](https://docs.aws.amazon.com/lambda/latest/dg/invocation-async-retain-records.html).

#### LS4 — Payment retries require a durable idempotent protocol

`skills/django-patterns/references/service-layer.md:43–56` charges the gateway before
saving order state, with no supplied stable idempotency key or durable charge receipt.
The extracted method charged twice after one failed save and retry in fake objects;
no actual payment was made. Acceptance: stable payment-attempt identity, durable
intent/receipt, reconciliation of ambiguous gateway results and a notification outbox;
test failed persistence, concurrent retry, response timeout and notification failure.
[Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests).

#### LS5 — Returned failure payloads must become application failures

`skills/backend-patterns/references/database.md:51–83` catches SQL errors into
`success:false`, while its client checks only the RPC transport error and returns data.
The exact client logic, with two TypeScript annotations removed, resolved this failure
payload; success and transport-error controls behaved as expected. SQL itself was not
executed. Acceptance: rethrow database errors or explicitly validate a typed result;
preserve safe diagnostic context, avoid exposing raw SQL internals, and test real
database rollback plus the client's rejection contract. [Supabase RPC results](https://supabase.com/docs/reference/javascript/rpc).

#### LS6 — Tenant isolation needs scoped context and restricted roles

`rules-library/sql/security.md:25–36` and its migrated SQL reference use session-wide
`SET app.tenant_id`. The private PostgreSQL fixture's next transaction, with no new
context, still returned tenant 42. A non-superuser table owner saw both tenants;
transaction-local context and forced owner RLS controls behaved as expected.
[PostgreSQL SET](https://www.postgresql.org/docs/current/sql-set.html),
[row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html).
Lines 164–177 wrongly characterize normal invoker permissions as escalation and promote
`SECURITY DEFINER` as correct; the created definer function was executable by PUBLIC by
default. This sample's `pg_notify` alone does not demonstrate privilege theft.
[PostgreSQL function security](https://www.postgresql.org/docs/current/sql-createfunction.html).
Acceptance: fail-closed per-transaction trusted tenant context, non-owner/non-BYPASSRLS
application roles, least-privilege invoker default and narrowly justified definer grants;
test pooled reuse, absent context, role bypass and public-execution boundaries.

#### LS7 — Recommended hashers must not be claimed as framework defaults

`rules-library/ruby/security.md:115` and the migrated Rails reference claim Devise
uses Argon2id by default since 4.10; official encryption source uses bcrypt.
[Devise encryptor](https://github.com/heartcombo/devise/blob/main/lib/devise/encryptor.rb).
`skills/django-patterns/SKILL.md:157,252` describes Argon2 as the default, while Django
5.2 defaults to PBKDF2. Argon2 requires explicit installation/configuration.
[Django password management](https://docs.djangoproject.com/en/5.2/topics/auth/passwords/).
Acceptance: version-scoped verified defaults, explicit Argon2 setup when chosen, effective
configuration tests and retained legacy hashers so existing accounts can authenticate
and migrate. The recommendation to evaluate Argon2 itself is not the defect.

#### LS8 — Migration safety must describe actual locks and concurrent writes

`skills/database-migrations/SKILL.md:47–55` calls nullable `ADD COLUMN` lock-free and
describes a non-default NOT NULL addition as a full rewrite. The fixture observed
`AccessExclusiveLock` and, on a populated table, NOT NULL violation SQLSTATE 23502.
Metadata-only operations can still wait for locks. [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html).
Lines 79–86 backfill before dual-write deployment. A write in that gap left old/new
columns different in the fixture. Acceptance: explain lock level/version/default
conditions, bound lock acquisition, deploy compatible dual writes before backfill or
prove a reliable catch-up protocol, reconcile mismatches, switch readers and retire old
writers before dropping the column. Test concurrent writes and lock contention.

### Existing findings extended, not double-counted

- **S1:** Rust/Kotlin/Ruby lack dedicated file-to-skill sections in common auto-skills,
  despite their available procedures; Dart and C# routes omit their new language skills
  and specialist roles. PHP has a build resolver but no dedicated language rule set or
  pattern skill in this inventory. Reconcile supported scope rather than invent parity.
  Claude automatic triggers/tool names and imported model tiers remain conventions;
  Codex procedure selection is explicit. No additional automatic-activation claim is made.
- **S2:** 39 generated native roles total 366,844 bytes; the largest is 27,164 bytes.
  These are available body sizes, not proof that all bodies load eagerly. Split/routable
  content should preserve required safeguards and the one-helper/default-local policy.
- **S3:** The isolated role probe parses all 39 TOMLs, checks exact metadata keys,
  adapted body preservation and adaptive prefixes, and finds no explicit model/tool
  keys. It does not verify installation, role discovery, effective model inheritance
  or behavior. `tests/codex/test_install.py:160` checks metadata/supporting files,
  not native instruction-body quality; `test_runtime.py:50` tests skill/hook discovery,
  not native-role behavior. Add negative instruction mutations and independent expected
  outcomes in both runtimes. Parsed TOML is not a successful specialist review.
- **QA1–QA6:** All six earlier QA findings remain open; this review does not close them.
  Broad guidance retains useful language-specific testing, concurrency, accessibility,
  lineage and rollback techniques. Finding no new defect on a surface is not certification.

### Review receipts and next implementation sequence

| Check | Completed result | Meaning |
| --- | --- | --- |
| Agent/division inventory and in-memory conversion | Exit 0; 39 roles / 16 divisions | Structural conversion only |
| Language/skill inventory | Exit 0; 18 sets / 100 rule files / 134 skills | Catalog coverage only |
| C++ path fixture | Compile/run exit 0; sibling escape reproduced, normal control passed | Unsafe example reproduced |
| Swift actor fixture | Compile/run exit 0; save/delete/corrupt-file failures reproduced; reload control passed | Durability example defect reproduced |
| Backend RPC fixture | Node exit 0; failed payload resolved; controls passed | Client contract reproduced; SQL execution unavailable |
| Django payment fixture | Driver exit 0; two fake charges after failed save/retry | Extracted method fault, not a PSP integration test |
| AWS webhook fixture | Driver exit 0; failed event claim survived and suppressed retry | Offline protocol model only |
| SQL security/migration fixture | Driver/psql exit 0; nine observations plus expected 23502 | Private socket-only PostgreSQL, no existing database |
| Repository Markdown lint | CLI exit 0; 903 files / zero errors | Document formatting only |
| Repository link integrity | Exit 0; 1,704 links across 904 files | In-repository targets resolve |
| Tracked worktree whitespace | `git diff --check` exit 0 | Whitespace only; untracked audit checked by Markdown lint |

The language driver completed with five successful reproduction assertions. That exit
status means the defects were observed, **not** that fixes passed. C++ used Apple Clang
21 with `-std=c++20 -Wall -Wextra -Werror`; Swift 6.3.3 used Swift 6 mode,
`-strict-concurrency=complete -warnings-as-errors`; the client probe used Node v26.0.0.
The PostgreSQL 17.10 (Homebrew) fixture initialized a new private cluster, disabled TCP listening,
used explicit private socket/user/database arguments, and stopped the cluster with
a checked exit 0 before removing it. It did not use ambient database credentials.

Private evidence: `/tmp/council-language-inventory-20261005.json`,
`/tmp/council-language-probes-20261005.py`,
`/tmp/council-language-probes-20261005.json`,
`/tmp/council-postgres-review-20261005.py`,
`/tmp/council-postgres-review-20261005.json`, and
`/tmp/council-agents-review-20261005.qeocdocq.json`.
`/tmp/council-agents-language-source-20261005.json` records SHA-256 hashes of the seven
probed source files and both language drivers at the reviewed revision. Formatting
and link logs are `/tmp/council-agents-language-markdown-20261005.log` and
`/tmp/council-agents-language-links-20261005.log`. Temporary files may expire;
retain regression fixtures in the eventual implementation commits. The independent
helper performed an instruction review, not a behavioral evaluation. No separate
model/API evaluation, installed/trusted-hook changes or live product/service validation
were performed.

Prioritize the unsafe boundaries (AD1/AD2, LS1–LS4/LS6) and align the decision contract
(AD8), then correct failure propagation, migrations, hashers and regulatory/provider
guidance. Update original and migrated copies together. Add the corresponding durable
fault/control tests, then independently grade specialist output in Claude and Codex.
These were the review
acceptance criteria before implementation. The cumulative status above records the source
fixes and the current receipts below supersede this historical implementation handoff.

## Original recommended remediation order — historical

First isolate the test harness, then fix H1/H2 and H4 with executable-command/result
fixtures. Next fix H3/H5 persistence and marker integrity. Then address native feedback,
timeouts, silent typecheck errors and source/install reconciliation. Finally reconcile
routing guidance, split large entrypoints, expand behavioral evaluation and tighten
quality-gate coverage. Keep the existing authoritative plan updated and verify both
runtime adapters; do not solve context overload by disabling required checks.

That sequence has now been implemented locally. The current receipts distinguish source
acceptance from installation, hook trust and live deployment verification.

## Current implementation receipts — October 5, 2026

The candidate source contains remediation for all 40 finding IDs. The worktree remains
`/Users/APPLE/claude-council` on `fix/council-code-quality-20260928`, based on
`759f9286c051753c7c99f8a1c4c8ec593ccd79e7`. Pre-existing edits were preserved. This batch
has not committed, pushed, installed new resources or changed live hook trust.

| Completed check | Actual terminal result | Evidence boundary |
| --- | --- | --- |
| Full isolated Node suite, concurrency 2 | Exit 0; 1,134 passed, zero failed/skipped | Required pinned edit tools; private HOME/TMP fixtures |
| Latest malformed model-state controls | Exit 0; 12 passed | Added test was separately run after the full suite had read this module; counts overlap |
| Python suite | Exit 0; 113 passed, one optional skip, 114 total | Private compiler/PostgreSQL/durable-payment fixtures, not live services |
| Native private-home Codex discovery | Exit 0; one passed | Separately exercised the optional skipped discovery check; no trust bypass |
| Final cwd/scope regression set | Exit 0; 173 passed, zero failed/skipped | Actual child-process cwd proof and malformed scope negatives |
| Latest agent instruction contracts | Exit 0; nine passed | Contract assertions, not a guarantee of every model answer |
| Strict ESLint | Exit 0; 51 changed JS/MJS files | Recommended/Sonar/import/promise/security checks; narrowly scoped validated-path fixture exceptions |
| Strict Ruff and Pyright | Exit 0; new eight Python files, zero type errors/warnings | Strong rule set plus separately checked changed Python source |
| ShellCheck and actionlint | Exit 0 | Changed Bash installer and repository workflow syntax; no hosted CI claim |
| Structure verification | Exit 0; 21 checks | 26 common rules, 19 language stacks, 134 skills, 39 agents, 33 commands |
| Named citation presence | Exit 0; 163 passed, ten explicit utility exceptions | Presence only; not accuracy, currency or regulatory certification |
| Source instruction budget | Exit 0; 992/992 explicit declarations; eager 20,023/24,576 bytes | Malformed paths remain eager; bytes/4 remains a token estimate |
| Documentation checks | Exit 0; Markdown zero findings, 2,125 links resolved across 935 files, 805 orphan candidates clear | Repository documentation, not external link availability |
| Artifact consistency and whitespace | Exit 0; source/response hashes and 13 Claude completions verified; git diff check clear | Consistency does not certify advice quality |

Primary terminal logs are `/tmp/council-final-node-rerun-20261005.log`,
`/tmp/council-final-model-state-20261005.log`, `/tmp/council-final-python-20261005.log`,
`/tmp/council-final-native-discovery-20261005.log`,
`/tmp/council-final-scope-controls-rerun-20261005.log`,
`/tmp/council-final-agent-contracts-latest-20261005.log` and
`/tmp/council-final-source-budget-20261005.log`. Strict lint receipts are preserved in
the corresponding `council-final-*` logs; the ESLint JSON report is
`/tmp/council-changed-eslint.json`. Temporary files can expire. Regression tests and
the [durable behavioral bundle](../tests/skills/evidence/2026-10-05/README.md) remain in
the candidate tree.

Actual C++ and Swift compilation exercised containment and persistence failures.
TypeScript compilation and RPC tests exercised false, null, malformed and transport
failure results. A private PostgreSQL server exercised runtime-role RLS, missing tenant
context, pooled reuse, function privilege boundaries, rollback, lock contention and
concurrent migration writes. Extracted durable payment protocols exercised commit/lost
acknowledgement, concurrent retry, decline, outbox failure and consumer deduplication.
These are local operating-model tests, not live provider/AWS/Django durability claims.

The [durable verification receipts](../tests/skills/evidence/2026-10-05/verification-receipts.json)
preserve log hashes and excerpts alongside the failed review run. The
[artifact validation](../tests/skills/evidence/2026-10-05/artifact-validation.json)
checks the packaged sources and raw responses; original temporary paths are provenance,
not requirements to keep `/tmp` files indefinitely.

One separate independent review run timed out in an unrelated audit-redaction child
process: 172 passed, one failed. That failure is retained in
`/tmp/council-final-recheck-node-20261005.log`. The root full rerun above completed with
no failures; the independent focused rerun also passed 25 checks. Earlier ESLint failures
were corrected before its final passing run.

The frozen behavioral evaluation contains 19 core criteria over six scenarios, six wrong
advice controls and all 26 actual drafts. Latest selected Claude/Codex drafts meet those
core criteria, including the final correction to the Codex reviewer's missing
server-authorized tenant recommendation. However, four Claude targeted retests still
fail supplemental factual discipline: they invent absent priced offers, undefined audit
metadata, uninspected mock assertions/incident causes or unseen database authorization
and grants. Those failures remain explicit in [manual grading](../tests/skills/evidence/2026-10-05/manual-grading.json).
Source instructions now prohibit those assumptions. A subsequent
[G1 retest](../tests/skills/evidence/2026-10-05/claude-g1-retest/protocol.json) passed
all four scenarios with core criteria intact, after a further absence-as-fact edit to
the lead source per scenario. The first 04-sdlc-quality attempt over-corrected into
meta-talk (core criteria absent, draft preserved); the test-strategy wording was revised
to license reasoning from the brief's stated premises before the passing attempt. One
passing draft per scenario, graded rubric-aware and non-blinded by the editor of the
sources, does not establish that the models consistently obey these instructions.
No blanket behavioral acceptance is claimed.

## Local Codex and VS Code follow-up — October 5, 2026

The user authorized testing the local Codex and VS Code behavior, configuration and
settings. Checks used real installed binaries and the VS Code extension-test API,
with private user-data directories, private copies of installed extensions and a
fresh candidate Codex home. Personal settings and live Council hook trust were not
edited. The candidate contained 1,101 managed files and passed installer integrity;
it was not promoted into either live runtime.

**I2 — P2, fixed and locally tested:** the VS Code, Cursor and Windsurf templates
used nonexistent `anthropic.claudeCode.*` keys. Registered settings use
`claudeCode.initialPermissionMode` and `claudeCode.allowDangerouslySkipPermissions`.
The VS Code template also now includes `chatgpt.openOnStartup: false` and
`chatgpt.followUpQueueMode: steer`. Its comments identify both runtimes and separate
editor preferences from Codex TOML configuration and hook trust. `INSTALL.md`
documents those boundaries. The installed extension manifests accepted all eight
setting assignments across the three templates; JSONC parsing and three negative
controls rejected an obsolete key and invalid Claude/Codex enum values.

| Check | Completed result | Boundary |
| --- | --- | --- |
| Codex 0.159.2 and 0.160.0 app-server | Strict config load, skills/list and hooks/list passed for live and private candidate homes | Discovery/configuration only; no model turn |
| Compact discovery and offline prompt rendering | One Council router; five prompt items; latest serialized input 15,952 bytes | Local render, not measured model token usage. Hook-cycle compaction stress now covered by compaction-stress.test.mjs (25 repeated cycles, byte-identical re-injection, O(1) durable growth); live model summarization remains untested |
| Native hook trust | Five live hooks trusted; five candidate hooks untrusted | No trust bypass or candidate-hook execution |
| VS Code 1.140.0, current private empty window | Both extensions active; Codex app-server initialization confirmed | Copied current settings, private candidate Codex home |
| VS Code candidate settings, restricted folder and empty window | Four explicit extension values correct; both extensions inactive/unavailable in Restricted Mode | Strict template keeps empty windows untrusted |
| Candidate private empty window with VS Code's default empty-window trust | Both extensions active; Codex app-server initialization confirmed | Diagnostic overlay only; no real project or hook was trusted |
| Independent template review | No remaining concrete defect; settings, schemas, enums and duplicate-property checks passed | Read-only source review, not conversational acceptance |

The final extension-host checks used Claude Code 2.1.289 and Codex
26.5930.51102. The earlier manifest review used Codex 26.5928.31416; native
discovery passed with both corresponding CLI versions. Startup acceptance required
an actual initialized app-server, registered Codex commands, a completed result
receipt and successful application exit. A command merely launching was not counted.

The [runtime evidence bundle](../tests/runtime/evidence/2026-10-05/README.md) preserves
filtered receipts, hashes, prompt-size summaries and the test boundaries. Earlier
failed attempts remain documented: the CLI wrapper returned before tests completed;
long temporary paths broke macOS Unix sockets; an initial private extension inventory
needed correction; a prompt command rejected an unsupported strict-config flag.
Short private paths, a correct private registry and stronger startup assertions
resolved those test-harness failures. Computer Use permission was unavailable, so
GUI interaction was not tested. Cursor and Windsurf received manifest/schema checks,
not actual application startup tests. Built-in VS Code components also emitted warnings;
these runs do not establish warning-free startup.

A GitHub localhost OAuth callback appeared during the local testing. The exact source
was not proven; the private VS Code instances had exited and no listener remained
on port 59036. GitHub sign-in was not required for the checks. Authorization query
values and complete authentication logs are excluded from the evidence bundle.

These results do not prove model replies, Claude compaction stability, runtime hook
execution, or the absence of all context-growth causes. The four supplemental Claude
factual-discipline failures remain open behavioral limitations. Source fixes, private
installation, discovery, trust and conversational acceptance retain separate statuses.

### Documentation follow-up — 2026-10-05

The final documentation sweep corrected the JetBrains guide's Claude-only assumptions,
unverified plugin IDs and shortcut claims. The guide now separates Claude Code and
Codex setup, shared styles and untested keymap actions, using current vendor references.
INSTALL, README and Architecture consistently distinguish shared templates from
runtime installation. The unreleased changelog now includes the cumulative remediation
and targeted IDE verification, retaining the open behavioral limitations.

The [documentation receipt](../tests/runtime/evidence/2026-10-05/documentation-followup.json)
records this follow-up. Original runtime receipt and source hashes remain historical
evidence; the new documentation does not imply another runtime test, live installation,
commit or push. JetBrains remains documentation-only coverage.
