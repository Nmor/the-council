#!/usr/bin/env bash
# Capture complete output, display a bounded tail, preserve the producer exit status.
# Usage: bash run-check.sh -l LOG [-n LINES] -- COMMAND [ARG...]
# Size budget: 4 KB. Check: token-budget.mjs --check.
set -euo pipefail
IFS=$'\n\t'
interrupt() {
  local signal_exit="$1"
  if kill -TERM "${producer_pid}" 2>/dev/null; then
    if wait "${producer_pid}"; then
      printf 'Producer exited during interruption\n' >&2
    else
      printf 'Producer stopped during interruption\n' >&2
    fi
  fi
  printf 'INTERRUPTED exit=%s log=%q\n' "${signal_exit}" "${log_file}"
  exit "${signal_exit}"
}
on_interrupt() { interrupt 130; }
on_terminate() { interrupt 143; }
log_file=''
lines=30
while getopts ':l:n:' option; do
  case "${option}" in
    l) log_file="${OPTARG}" ;;
    n) lines="${OPTARG}" ;;
    *) printf 'UNAVAILABLE: usage: -l LOG [-n LINES] -- COMMAND [ARG...]\n' >&2; exit 64 ;;
  esac
done
shift "$((OPTIND - 1))"
if [[ -z "${log_file}" || $# -eq 0 || ! "${lines}" =~ ^[1-9][0-9]*$ ]]; then
  printf 'UNAVAILABLE: require log path, positive line limit and command\n' >&2
  exit 64
fi
if ! (umask 077; : > "${log_file}"); then
  printf 'UNAVAILABLE: cannot create log: %s\n' "${log_file}" >&2
  exit 73
fi
if ! command -v "$1" >/dev/null 2>&1; then
  unavailable_exit=127
  if [[ -e "$1" ]]; then unavailable_exit=126; fi
  printf 'UNAVAILABLE exit=%s command=%q\n' "${unavailable_exit}" "$1" > "${log_file}"
  printf 'UNAVAILABLE exit=%s command=%q log=%q\n' "${unavailable_exit}" "$1" "${log_file}"
  exit "${unavailable_exit}"
fi
"$@" > "${log_file}" 2>&1 &
producer_pid=$!
trap on_interrupt INT
trap on_terminate TERM
printf 'RUNNING exit=unknown cwd=%q log=%q command=' "${PWD}" "${log_file}"
printf '%q ' "$@"
printf '\n'
if wait "${producer_pid}"; then
  producer_exit=0
else
  producer_exit=$?
fi
case "${producer_exit}" in
  0) status=PASS ;;
  126|127) status=UNAVAILABLE ;;
  130|143) status=INTERRUPTED ;;
  *) status=FAIL ;;
esac
if ! tail -n "${lines}" "${log_file}"; then
  printf 'UNAVAILABLE: log display failed; producer_exit=%s log=%q\n' "${producer_exit}" "${log_file}" >&2
  if [[ "${producer_exit}" -ne 0 ]]; then exit "${producer_exit}"; fi
  exit 74
fi
printf '%s exit=%s log=%q\n' "${status}" "${producer_exit}" "${log_file}"
exit "${producer_exit}"
