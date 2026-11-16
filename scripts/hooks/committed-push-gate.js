#!/usr/bin/env node
// Size budget: 4 KB. Check: token-budget.mjs --check.
'use strict';
const { git, outgoing, problemsFor, conditionalProblems } = require('./lib/committed-proof.js');
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  input += chunk;
  if (Buffer.byteLength(input) > 128 * 1024) {
    process.stderr.write('[council-push] BLOCKED: ref update input exceeds limit\n');
    process.exit(1);
  }
});
process.stdin.on('end', () => {
  try {
    const updates = input.trim().split('\n').filter(Boolean);
    if (updates.length === 0) return;
    if (process.env.COUNCIL_PUSH_AUTHORIZED !== 'yes' && process.env.CLAUDE_PUSH_AUTHORIZED !== 'yes')
      throw new Error('explicit owner authorization is required for this push');
    const root = git(process.cwd(), ['rev-parse', '--show-toplevel']);
    const tips = updates.map(update => update.split(/\s+/)[1]).filter(tip => !/^0+$/.test(tip));
    const failures = outgoing(root, process.argv[2], updates, process.argv[3]).flatMap(commit =>
      problemsFor(root, commit, tips).map(reason => `${commit.slice(0, 12)}: ${reason}`));
    failures.push(...conditionalProblems(root, tips));
    if (failures.length) throw new Error(failures.join('\n'));
  } catch (error) {
    process.stderr.write(`[council-push] BLOCKED: ${error.message}\n`);
    process.exitCode = 1;
  }
});
process.stdin.on('error', error => {
  process.stderr.write(`[council-push] BLOCKED: cannot read ref updates: ${error.message}\n`);
  process.exitCode = 1;
});
