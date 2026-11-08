# Engineering judgment

> Size budget: 2 KB.

Make decisions with evidence, clear tradeoffs, relevant failure modes and ownership of the outcome. Depth is proportional to risk; verbosity, a fixed number of sections or a forced committee does not prove quality. Preserve correctness, security and verification while removing process that does not change the decision.

For substantive work, map requirements and invariants to complete executable wiring,
consumer compatibility and meaningful success/failure checks. Choose tools by verified
fitness and supported capabilities. No shortcuts that hide failures, weaken gates or
drop acceptance. Review the actual diff; comments explain intent, and PRs describe
final behavior with evidence tied to the reviewed revision. Distinguish local tests
from installation and runtime verification.

For relevant detailed procedures and examples, read
[the reference](../../rules-library/council-detail/principal-level-mandate.md).
Do not preload it for unrelated work.
