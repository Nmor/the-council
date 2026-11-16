# Completion criteria

> Size budget: 2 KB.

The commit-review-test-push contract is defined once in `verify-before-claim.md`.

Distinguish built, committed, reviewed, tested, integrated and deployed — claim
only the levels actually reached.

Review scope: report every CRITICAL, HIGH, MEDIUM and LOW finding in one round.
Substantive code retains two independent reviewer perspectives matched to the
surface, including security where relevant.

Git's native pre-push hook enforces commit-bound evidence:
[proof protocol](../../rules-library/common/review-proof-protocol.md);
the commit hooks no longer require review, coverage or tests. Review scope detail:
[deep-review reference](../../rules-library/council-detail/pre-commit-deep-review.md).
