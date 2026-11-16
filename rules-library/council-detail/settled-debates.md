# Settled debates — archive

> The Council's case law: verdicts from best-idea-wins debates. Append-only;
> the hot list in council-rules holds only the entries that still fire often.
> A verdict is cited, never re-litigated, unless its evidence changes.

## 2026-11-15 — superpowers, ponytail, design, security, language sweeps

**Settled debates (2026-11-15, ponytail vs Council — do not re-litigate; cite
this list):** (a) coverage: repository gates and the canonical coverage floors
win; ponytail's single `__main__` self-check never substitutes for the repo's
test runner; its "trivial one-liners need no test" stands. (b) scope: build
what was asked in its simplest form; naming the lazier option is one line, not
a reason to ship less — requirement changes are owner-owned. (c) reporting:
evidence blocks (commands, exit codes, failures) are a floor; ponytail's
three-line cap applies to rationale prose only. (d) deletion: ponytail tags
may delete only what the current diff introduced; inherited caller-less code
follows no-bloat triage. (e) interfaces/DI: an interface is justified by a
real test seam (a fake counts as a second implementation); otherwise ponytail's
no-speculative-abstraction wins. (f) new dependencies: ponytail's reuse ladder
first (stdlib → native → installed dep → few lines); search-first's adoption
gate applies only when the ladder cannot cover it.

**Settled debates (2026-11-15, design + security + language sweeps):**
(g) reduced motion = fewer/gentler, not zero — non-motion feedback (color/opacity)
stays. (h) greenfield ease-out default is `cubic-bezier(0.23,1,0.32,1)`; the
project's existing token always wins; taste-skill's curve only inside its own
builds. (i) sticky headers: opaque + hairline by default; translucency only for
app chrome over scrolling content, gated on prefers-reduced-transparency.
(j) scroll-triggered reveals: banned in app UI; marketing one-offs only.
(k) motion conflicts: Emil skills beat ui-ux-pro-max. (l) violet/lavender hues:
taste's ban governs palette picks unless the brief pins them. (m) design menus:
decide, don't present option menus (theme-factory's picker only when the user
asks to pick). (n) target code runs fail-closed in a sandbox or not at all
(security-audit governs; plugin fix-jobs comply). (o) only confirmed findings
carry severity in Council reports; plugin low-confidence findings stay out of
severity tables. (p) finding suppression: never inline comments — tracked
exclusions with owner + expiry. (q) required security review runs on committed
revisions (owner policy); the security-guidance Stop-hook diff review is
advisory only. (r) pre-commit AgentShield/"before commits" wording in older
files is superseded by the same policy.
