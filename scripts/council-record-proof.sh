#!/bin/sh
# Record a Council proof by DOING the thing, never by asserting it.
#
# Size budget: 4 KB. Check: token-budget.mjs --check.
#
#   council-record-proof.sh gate     -- go build ./... && go test ./...
#   council-record-proof.sh coverage -- npm test -- --coverage
#
# It computes the tree the commit would record, runs your command, and writes
# .council/proofs/<kind>.json ONLY if that command exits zero. The proof therefore cannot exist
# without the work having happened, and it names the command that happened.
#
# WHY THIS EXISTS RATHER THAN AN AGENT WRITING THE FILE.
# A proof written by hand is a claim by the party it unblocks. That is self-certification, and
# a permission classifier is right to refuse it: from outside, an agent writing the file that
# satisfies its own commit gate is indistinguishable from an agent skipping the gate. Making the
# recorder run the check removes the question — the evidence is a side effect of the verification,
# so the only way to obtain it is to verify.
#
# The REVIEW proof is deliberately not obtainable here. A review is a judgement, not an exit
# code, so this script cannot earn one. In Claude Code the review proof is written by
# review-marker.js when a reviewer agent actually runs, which is the harness observing rather
# than the author asserting. In another runtime, writing it is a trust boundary you are crossing
# consciously: see rules-library/common/review-proof-protocol.md.
set -eu

kind=${1:-}
case "$kind" in
  gate|coverage) ;;
  review)
    printf 'council-record-proof: a review cannot be earned by a command.\n' >&2
    printf '  In Claude Code, dispatch a reviewer and the marker records it.\n' >&2
    printf '  Elsewhere, see rules-library/common/review-proof-protocol.md.\n' >&2
    exit 2 ;;
  *)
    printf 'usage: council-record-proof.sh <gate|coverage> -- <command...>\n' >&2
    exit 2 ;;
esac
shift
[ "${1:-}" = "--" ] || { printf 'council-record-proof: expected -- before the command.\n' >&2; exit 2; }
shift
[ "$#" -gt 0 ] || { printf 'council-record-proof: no command given.\n' >&2; exit 2; }

root=$(git rev-parse --show-toplevel) || exit 1
cd "$root"
tree=$(git write-tree)

# Run against the TREE, not the working directory. They differ whenever anything is unstaged —
# and in a checkout shared with another agent they differ constantly, so a check run in the
# working directory can pass or fail for reasons that have nothing to do with what is being
# committed. A proof must be about the artifact it names, so the artifact is what gets tested.
work=$(mktemp -d "${TMPDIR:-/tmp}/council-proof.XXXXXX")
cleanup() { rm -rf "$work"; }
trap cleanup EXIT INT TERM
git archive "$tree" | tar -x -C "$work"

set +e
(cd "$work" && "$@")
status=$?
set -e
if [ "$status" -ne 0 ]; then
  printf 'council-record-proof: the command failed against tree %s (exit %s); no proof written.\n' \
    "$tree" "$status" >&2
  exit "$status"
fi

mkdir -p .council/proofs

# The command is recorded so a reader can see WHAT was verified, not merely that something was.
# But a verification command routinely carries a credential — a database URL with a password in
# it is the ordinary way to run DB-backed tests — and an evidence file is still a file. So every
# NAME=value token keeps its NAME and loses its value, and any URL carrying user:pass loses the
# userinfo. A flag like -count=1 starts with a dash and is left alone, so the record stays
# readable. Redacting here rather than asking callers to remember is the only version that holds.
redacted=''
for word in "$@"; do
  case "$word" in
    [A-Za-z_]*=*) word="${word%%=*}=<redacted>" ;;
    *://*@*) word="$(printf '%s' "$word" | sed -e 's#://[^@/]*@#://<redacted>@#')" ;;
  esac
  escaped=$(printf '%s' "$word" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')
  redacted="$redacted$escaped "
done

printf '{"tree":"%s","at":%s000,"command":"%s"}\n' \
  "$tree" "$(date +%s)" "${redacted% }" \
  > ".council/proofs/$kind.json"
printf 'council-record-proof: %s proof recorded for tree %s\n' "$kind" "$tree"
