# Integration wiring

> Size budget: 2 KB.

Trace new capabilities from their real entrypoint through dependencies to observable behavior. Check
registrations, configuration, consumers, error paths and cleanup. For replacement work, test without
the old service. Review the affected path once and expand only if evidence reveals additional
dependencies; avoid repetitive whole-system sweeps. Inherited caller-less symbols fail the gate as
UNRESOLVED, not deletable: triage per `no-bloat.md`.

[Reference](../../rules-library/council-detail/wiring-and-usage-review.md).
