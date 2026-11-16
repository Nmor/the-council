#!/usr/bin/env node
// Size budget: 8 KB. Check: wc -c; gate: token-budget.mjs --check.
'use strict';

// TaskCompleted hook.
//
// Implementation is committed promptly; acceptance follows required checks and
// independent review of that committed revision. Keep both states explicit.
//
// Fires when a task is completed in a session where no gate has been observed, using
// the same session marker the intake hooks already write. SILENT once a gate has run —
// which is the normal path, so this stays quiet on well-run work.

const { proofFor } = require('./lib/verification.js');

let data = '';
process.stdin.on('data', (c) => { data += c; });
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data || '{}');
    if (input.session_id && proofFor('gate', input)) process.exit(0);

    process.stdout.write(JSON.stringify({ systemMessage:
      '[task-gate] A task was marked complete with no verification gate observed this ' +
      'session (no-overclaim.md). Commit implementation promptly and record review/test pending separately. ' +
      'Accepted requires required checks and review on the exact committed revision, with ' +
      'its output attached. If a gate did run, this marker simply was not written — ' +
      'attach the block. If it did not, the task is "implemented, verification pending".' }));
  } catch (err) {
    process.stderr.write(`[task-gate] skipped: ${err.message}\n`);
  }
  process.exit(0);
});
