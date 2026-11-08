# Completion criteria

> Size budget: 2 KB.

Complete the scoped acceptance, tests and integrations before claiming done; distinguish written, tested, integrated and deployed. A migration needs the replacement working with the old dependency stopped. No unrelated audits.

Substantive code needs an independent DEEP review before it lands (`commit-gate.js` enforces it):
gates prove code runs, not that it is right. Deep means two or more reviewers matched to the
surface, reading the implementation and its consumers, not the diff alone; `security-reviewer`
for credentials, authorization, tenancy, money or user data. Give each the diff and acceptance, not your conclusion. Docs, fixtures and
one-line fixes are exempt.

One task, one commit, one review round: reviewers report every CRITICAL, HIGH, MEDIUM and LOW
finding in it. Fix all in one pass; a short confirmation of only the fix binds the tree. Full suite
once per commit, beside the review; independent tasks in parallel.

Where agents share a repository, enforce this with the repo's own pre-commit hook and bind each
proof to the artifact: [review proof protocol](../../rules-library/common/review-proof-protocol.md).
Checks the gate can't see (another repo, a container): write their proofs after each passes;
never ask to turn the gate off.

For what makes a review deep, and why it is not ceremony, read
[the deep-review reference](../../rules-library/council-detail/pre-commit-deep-review.md).

For relevant detailed procedures and examples, read
[the reference](../../rules-library/council-detail/done-criteria.md).
Do not preload it for unrelated work.
