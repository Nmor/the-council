# Evidence before fixes

> Size budget: 2 KB.

Reproduce or inspect a failure on its actual path before changing behavior. Trace the smallest
useful dependency slice, state uncertainty and use a focused regression. Expand the investigation
when the evidence contradicts the hypothesis, not by routinely sweeping every repository.

Multi-component failure: instrument each boundary once (what enters, what exits); let evidence name
the failing layer before touching any. Three failed fixes on one bug: stop — the pattern is suspect;
question the architecture, not a fourth fix.

[Reference](../../rules-library/council-detail/diagnose-before-fixing.md).
