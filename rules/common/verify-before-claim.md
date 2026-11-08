# Verification evidence

> Size budget: 2 KB.

Run the required checks for the changed scope, inspect exit status and results, and report what they establish. Tie evidence to the code revision, inputs/environment and skips. Reuse still-valid evidence; rerun affected checks after a change or failure. Do not equate successful command exit with complete end-to-end acceptance or use a hook marker as test certification.

A green gate is not a read of the code. Substantive changes also need the pre-commit deep
review of `done-criteria.md`, reported with its reviewers and verdicts. A review goes stale
exactly as a test run does: an edit after it invalidates it.

For relevant detailed procedures and examples, read
[the reference](../../rules-library/council-detail/verify-before-claim.md).
Do not preload it for unrelated work.
