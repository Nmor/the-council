---
name: cisa-audit
description: Assess information-system controls using CISA-aligned risk, evidence and sampling methods; distinguish control design, operation, audit limitations and remediation ownership.
---

# CISA-aligned information-systems audit

Use for an IS audit, control-effectiveness assessment or evidence-readiness review.
This skill is not a CISA credential, independent audit opinion or certification.
Security scans and penetration tests can supply evidence but do not replace a control audit.

## Scope by risk

Define objective, system/entity boundary, criteria, period, population and materiality.
Select relevant areas from the [ISACA CISA domains](https://www.isaca.org/credentialing/cisa/cisa-exam-content-outline):
audit process; IT governance; acquisition/development/implementation; operations and
business resilience; protection of information assets. Cover only the areas needed for
the objective. State independence limits, especially when assessing work you implemented.

## Evaluate evidence

Map risk to control, owner, expected operation, evidence source and test. Separate design
adequacy, implementation at a point in time and operation over the requested period.
A policy or interview demonstrates intent, not effective execution. Use examination,
interview and tests as appropriate; [NIST SP 800-53A Rev. 5](https://csrc.nist.gov/pubs/sp/800/53/a/r5/final)
provides a complementary control-assessment method, not a substitute for ISACA criteria.

Read [sampling and findings](references/sampling-and-findings.md) before claiming operating
effectiveness. Establish population completeness, selection method, evidence provenance,
period coverage and exceptions. Do not fabricate samples, extrapolate a convenient sample
statistically or infer effectiveness from absent logs. Use controlled redacted evidence.
Not supplied is not confirmed absent. If metadata, period coverage or control design has
not been inspected, mark it unknown and request it rather than recording an observed defect.
Carry that distinction into tables and conclusions: an unspecified period, metadata or
control frequency is unknown, not confirmed undefined or absent. Owner selection limits
representativeness; it does not establish the owner's motive or the direction of bias.
Owner-selected screenshots cannot establish a population conclusion, but they may support
specific observations once examined. Do not presume what unseen screenshots contain.

## Report the conclusion

For each finding, record criteria, observed condition, evidence, supported cause,
business consequence, severity rationale, owner and corrective action. Mark unavailable
evidence and untested controls explicitly. Distinguish proven deficiency from an evidence
gap. Attach the supporting artifact to every claimed condition; an attribute with no
artifact moves to the evidence-request list as "not evidenced in the supplied material",
not as a stated property of the control. Final scan: any "undefined", "absent" or
"not performed" without a cited artifact becomes an evidence request. Recommend remediation and a retest; do not silently repair audit evidence or assert
closure without new evidence. Preserve the existing audit/implementation plan and user scope.

## Learning hooks

Record repeated evidence gaps and ineffective controls. Recommend a better evidence
source or control test while preserving auditor independence and operational ownership.

> **Size budget: 4 KB** — `token-budget.mjs --check`.
