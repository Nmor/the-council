---
name: incident-investigation
description: Investigate service incidents and recurring customer failures by correlating logs, traces, recordings and durable state; distinguish mitigation from demonstrated root-cause fixes.
---

# Incident investigation

Use for an outage, repeated customer failure or unexplained live regression. Reuse the
existing incident record and plan. Keep containment and causal investigation distinct.

## Build the evidence chain

Establish impact, time range, environment, deployed revision and affected/unaffected
examples. Normalize timestamps with timezone and clock-skew caveats. Start with one
representative failure and one comparison; expand only to test a hypothesis.

Follow a correlation ID across ingress, authentication, processing, dependencies,
response delivery, durable writes and deferred work. Include both directions of a flow,
retry attempts and finalization when applicable. Record missing spans rather than treating
absence as proof that nothing happened. For voice incidents, compare audio, transcript
and event timing; a transcript cannot establish silence, playout or interruption behavior.
Redact customer data and credentials from shared artifacts.

Separate observed facts, hypotheses and ruled-out explanations. Specify a discriminating
check before each investigation step. For latency, define caller-visible start/end
boundaries and account for gaps outside component spans; do not add overlapping timings.
For successful responses with missing effects, use
[data-reconciliation](../data-reconciliation/SKILL.md).

## Fix and validate

Apply authorized containment with a measured exit condition. Reproduce the failure or
explain what prevents reproduction. Test the smallest causal fix with a negative control,
failure injection or representative replay; label simulated results as simulated. Recheck
live impact when access permits. A disappearing alert or passing mock is insufficient
to establish durable recovery. Use [release-integration](../release-integration/SKILL.md)
when multiple deployments must move together.

## Deliverable and learning hooks

Record impact, causal timeline, evidence links, confidence, mitigation, permanent fix,
verification and remaining unknowns in the existing record. Capture the detection or
observability gap that would have shortened investigation; do not invent a root cause
to close the incident.

References: [Google SRE incident response](https://sre.google/workbook/incident-response/)
and [NIST SP 800-61 Rev. 3](https://csrc.nist.gov/pubs/sp/800/61/r3/final) for security incidents.

> **Size budget: 4 KB** — `token-budget.mjs --check`.
