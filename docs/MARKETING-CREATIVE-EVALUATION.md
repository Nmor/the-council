# Marketing and creative procedure evaluation

The October 5 remediation adds four focused procedures: `marketing-strategy`, `seo`,
`content-campaigns` and `brand-creative-direction`. Source entrypoints remain small and
available to the Claude compact transform and both Codex install profiles. This document
records scenario evidence; it does not certify an installed runtime or completed campaign.

## Scenario review

A bounded, read-only Council reviewer initially applied the source guidance to the four
briefs in [marketing-scenarios.json](../tests/skills/marketing-scenarios.json). That original
brief review performed no external model/API evaluation, publication, spending, outreach
or installation. The subsequent cumulative remediation also ran actual source-fed Claude
and native Codex advice trials; [their preserved evidence](../tests/skills/evidence/2026-10-05/README.md)
includes constrained creative adaptation and entrepreneurship drafts. These are distinct
from the original four-brief review and do not certify rendered deliverables or universal
model accuracy.

| Brief | Observed decision | Evidence boundary |
| --- | --- | --- |
| Pre-revenue Lagos SaaS; NGN 300,000; no baseline | Treat demand, conversion and CAC as unknown; reserve money and define one capped experiment with owner, review date and stopping rule | Proposed allocation is a planning sketch, not researched channel pricing or predicted ROI |
| Private invoices blocked by robots.txt; public page with noindex | Require invoice access-control verification; clarify intended public indexing before recommending a noindex change | Robots exclusions do not prove confidentiality; recommendations do not prove indexing |
| Unverified 50% saving; quote without permission | Record evidence and rights blockers; draft factual neutral copy with labeled proof placeholders | No invented claim, customer permission or replacement testimonial |
| Government portal with Arial/light theme; poster and portrait video | Preserve suitable existing typography/theme; adapt hierarchy, print exports, safe areas and captions to each medium | Actual render inspection, printer requirements and delivery dimensions remain necessary |

All four sketches met their scenario acceptance criteria. The review additionally found
five high-severity hook defects; those are tracked in the
[skills and hooks audit](SKILLS-HOOKS-AUDIT-2026-10-05.md), not hidden by the skill results.

## Repeatable checks

[test_marketing_skills.py](../tests/codex/test_marketing_skills.py) builds actual Codex
payloads using an isolated candidate Git index. It checks procedure bytes, catalog entries,
full-profile wrappers and compact discovery. It also verifies that Claude's compact
transform preserves procedure content and metadata. No live installation is modified.

The source guidance permits established fonts, conventional layouts and a single theme
when they fit the brief. Output quality still requires accessibility, claim/asset evidence,
appropriate exports and inspection of the actual rendered deliverables. These procedures
do not produce a design portfolio merely by being installed.
