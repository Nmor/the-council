# Return-value and error ownership

> **Size budget: 35 KB** — `token-budget.mjs --check`.

Read the canonical [no-discards contract](../../../rules-library/common/no-discards.md)
and applicable language guidance. Handle returned values and errors in production
and tests; do not use blank assignments to suppress them. Go's `for _, value := range`
is valid value iteration and does not drop a returned value or error. Do not rewrite
it merely to bind an unused index.

The canonical reference preserves detailed language examples and diagnostic patterns.
Search hits are investigation signals, not proof of a semantic violation. Hook behavior
must be verified in the active runtime; a rule file does not establish hook availability.
