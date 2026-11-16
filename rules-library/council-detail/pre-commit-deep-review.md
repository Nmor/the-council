# Post-commit deep review

> Size budget: 4 KB.
> Historical filename retained for existing links. Owner policy, 2026-11-09:
> commit first; review and test afterward; enforce acceptance before push.

A complete implementation is committed promptly. Only committed revisions enter
review and testing. No review rounds in worktrees: inspect the named commit and
its consumers directly. Use a temporary source archive for isolated test execution
when necessary; remove it afterward.

Substantive code retains two independent reviewer perspectives matched to its
surface. Read implementation and consumers, trace a complete path, and check
authorization, tenant isolation, idempotency, partial failure, wiring and tests.
Give reviewers the acceptance and revision rather than the author's conclusion.
Collect all severities in one round. Fix findings in follow-up commits and request
a short fix confirmation instead of repeating the whole review.

A commit passing static checks can still contain privilege escalation or expose a
credential. Independent review closes that gap after the checkpoint is durable
and before anyone publishes it. Local history is allowed to contain pending review;
publication is not.

Every outgoing commit needs post-commit verification and an approved independent
review. Project rules may require review even for documentation and test commits.
Follow the [agent-neutral protocol](../common/review-proof-protocol.md).
