#!/bin/sh
# Size budget: 1 KB. Check: token-budget.mjs --check.
# Run the required check against committed input and record only terminal success.
set -eu
exec node "$(dirname "$0")/hooks/record-commit-check.js" "$@"
