// Size budget: 4 KB. Check: token-budget.mjs --check.
'use strict';

function identity(check) {
  if (!check || typeof check.command !== 'string' || !check.command.trim() ||
      !Number.isInteger(check.exit_code) || check.exit_code < 0 || check.exit_code > 255)
    throw new Error('invalid required check');
  if (check.command_digest === undefined) return `command:${check.command.trim()}`;
  if (typeof check.command_digest !== 'string' || !/^[a-f0-9]{64}$/.test(check.command_digest))
    throw new Error('invalid required command digest');
  return `digest:${check.command_digest}`;
}

function verificationProblems(original, receipts, code) {
  if (!Array.isArray(original.checks) || !original.checks.length)
    return ['required post-commit checks have not all passed'];
  const required = original.checks.map(identity);
  const problems = [];
  for (const verified of receipts) {
    const rerun = new Set();
    if (verified.exit_code !== 0 || !Array.isArray(verified.checks) || !verified.checks.length) {
      problems.push('required post-commit checks have not all passed');
      continue;
    }
    for (const check of verified.checks) {
      const key = identity(check);
      if (check.exit_code !== 0) problems.push('required post-commit checks have not all passed');
      else rerun.add(key);
    }
    if (required.some(key => !rerun.has(key)))
      problems.push('corrective verification must rerun every original required check on each correction');
    if (code && (!Number.isFinite(verified.coverage) || verified.coverage < 0 || verified.coverage > 100))
      problems.push('source coverage has not been measured after commit');
  }
  return problems;
}

module.exports = { verificationProblems };
