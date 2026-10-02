#!/usr/bin/env node
// Size budget: 8 KB. Check: wc -c; gate: token-budget.mjs --check.
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { adviceJSON, context, pointers, readInput } = require('./lib/lifecycle-context.js');

// Shared session exports are historical records, not a project handoff.
// Native startup/resume already loads instructions and memory.
readInput('SessionStart', input => {
  if (input.source === 'compact') return;
  fs.mkdirSync(path.join(os.homedir(), '.claude', 'sessions'), { recursive: true });
  const targets = pointers(context(input));
  if (!targets.length) return;
  process.stdout.write(adviceJSON('SessionStart', 'Continue the requested task. If durable state is needed, read only the ' +
    'current handoff and relevant sections; do not reload full memory or plan history.\n' + targets.join('\n')));
});
