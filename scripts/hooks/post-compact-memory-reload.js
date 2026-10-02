#!/usr/bin/env node
// Size budget: 4 KB. Check: wc -c; gate: token-budget.mjs --check.
'use strict';
const { adviceJSON, context, pointers, readInput } = require('./lib/lifecycle-context.js');

// SessionStart compact is the model-visible recovery channel. Native compaction
// supplies a summary; do not require rereading the entire durable history.
readInput('post-compact', input => {
  if (input.source !== 'compact') return;
  const targets = pointers(context(input));
  if (!targets.length) return;
  process.stdout.write(adviceJSON('SessionStart', '[post-compact] Continue the existing task from the summary. If a detail is missing, ' +
    'read only the current handoff and relevant sections. Do not reload full memory, plan history or ' +
    'Council references, or repeat intake and completed reviews.\n' + targets.join('\n')));
});
