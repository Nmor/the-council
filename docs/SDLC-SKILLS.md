# Council skills for delivery and everyday decisions

These focused skills extend existing engineering and domain guidance. Select the smallest
useful procedure for the task; no new agents, hooks, forced reviews or startup reads are
required. The compact Council router remains the discovery entrypoint.

| Request | Skill | Evidence or result |
| --- | --- | --- |
| “What behavior would make this feature done?” | [requirements-acceptance](../skills/requirements-acceptance/SKILL.md) | Observable contract mapped to implementation and checks |
| “Customers still see failures; where do they start?” | [incident-investigation](../skills/incident-investigation/SKILL.md) | Correlated timeline, tested hypothesis and recovery evidence |
| “Can these repositories safely ship together?” | [release-integration](../skills/release-integration/SKILL.md) | Exact revision/dependency map, compatibility and rollout evidence |
| “Which tests would catch this regression?” | [test-strategy](../skills/test-strategy/SKILL.md) | Risk-based boundaries and independent behavioral oracles |
| “Council keeps compacting or repeating reviews.” | [council-workflow](../skills/council-workflow/SKILL.md) | Measured context cause and bounded continuation |
| “Success was returned but records disagree.” | [data-reconciliation](../skills/data-reconciliation/SKILL.md) | Intent-to-state discrepancies and verified safe repair |
| “Can we actually restore or fail over?” | [resilience-drills](../skills/resilience-drills/SKILL.md) | Executed recovery time/data-loss and correctness evidence |
| “Is this venture viable; what should we test next?” | [entrepreneur](../skills/entrepreneur/SKILL.md) | Customer evidence, economics and affordable decision experiment |
| “Validate this attack path on our authorized target.” | [pentester](../skills/pentester/SKILL.md) | Scoped reproducible proof and remediation retest |
| “Are our controls designed and operating effectively?” | [cisa-audit](../skills/cisa-audit/SKILL.md) | Period/population-aware findings and evidence limitations |

## Use and installation

In compact Claude installations, ask Council to select the named skill or invoke its
slash command explicitly. Read supporting references only for the relevant calculation,
active-test scope or audit sampling. In Codex compact mode, use `$council` and select the
resource from `council/catalog.md`. The optional full profile exposes names such as
`$council-pentester`. Source skills remain usable in normal automatic discovery; compact
installations deliberately keep one router visible to control instruction cost.

Existing authorization still governs external probes, messages, pushes, deployment,
repairs and recovery faults. These procedures neither grant permissions nor introduce
repeated approvals. Entrepreneur complements lean-startup; pentester complements routine
security review; CISA audit evaluates controls and does not confer a professional credential.

## Verification

In the source repository, behavior scenarios are in `tests/skills/sdlc-scenarios.json`.
Use an independent agent with the raw scenario and the relevant skill, without the
expected-answer rubric. Restrict effects to a temporary workspace. Evaluate its actual
analysis/artifacts, calculations, evidence claims and scope choices. Include negative
routing cases; a simple typo edit must not become an audit or release ceremony.

The source installation regressions in `tests/codex/test_sdlc_skills.py`
check preservation of all new resources and full/compact availability without additional
agents or automatic hook execution. Run with the existing Python suite:

```bash
python3 -m unittest discover -s tests/codex -v
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/pentester
bash bootstrap/verify.sh --prefix "$PWD" --verbose
bash tests/verify-link-integrity.sh
bash tests/verify-no-orphans.sh
bash tests/verify-standards-citations.sh
markdownlint-cli2
node scripts/token-budget.mjs --root . --check
```

Repeat skill validation for each new folder. Metadata/link/budget checks are structural;
they do not prove model behavior. Record actual scenario outcomes, lint/test exit status,
installed profile and any unavailable runtime checks in the existing implementation plan.
