#!/usr/bin/env bash
# Hook test harness: installs the pinned tools once, then runs the suite with
# COUNCIL_TEST_NODE_MODULES set, as the tests require.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE"
[ -d node_modules ] || npm ci --silent || { echo "npm ci failed (lockfile?)" >&2; exit 1; }
export COUNCIL_TEST_NODE_MODULES="$HERE/node_modules"
cd "$HERE/../.."
exec node --test scripts/hooks/__tests__/*.mjs
