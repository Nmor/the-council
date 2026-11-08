# Integration wiring

> Size budget: 2 KB.

Trace new capabilities from their real entrypoint through dependencies to observable behavior. Check registrations, configuration, consumers, error paths and cleanup. For replacement work, test without the old service. Review the affected path once and expand only if evidence reveals additional dependencies; avoid repetitive whole-system sweeps. A caller-less symbol your change did not introduce fails the gate as UNRESOLVED, not as deletable: triage it per `no-bloat.md`, name the alternative that covers its use case before any delete, and prefer fixing and testing it over deleting it when it answers a question the product needs.

For relevant detailed procedures and examples, read
[the reference](../../rules-library/council-detail/wiring-and-usage-review.md).
Do not preload it for unrelated work.
