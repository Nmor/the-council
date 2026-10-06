#!/usr/bin/env bash
# Size budget: 2 KB.
# Named citation presence only; see the Python verifier for scope and limitations.
set -euo pipefail
script_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec python3 "${script_root}/scripts/verify-citations.py" "$@"
