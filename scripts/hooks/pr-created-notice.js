#!/usr/bin/env node
// Size budget: 4 KB. Check: wc -c; gate: token-budget.mjs --check.
'use strict';
const { adviceJSON, readInput } = require('./lib/lifecycle-context.js');

readInput('pr-created-notice', input => {
  const command = input.tool_input?.command;
  if (typeof command !== 'string' || !/\bgh\s+pr\s+create\b/.test(command)) return;
  const response = input.tool_response || input.tool_output;
  const text = typeof response === 'string' ? response : response?.stdout || response?.output;
  if (typeof text !== 'string') return;
  const match = text.match(/https:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\/pull\/(\d+)\b/);
  if (!match || match[0].length > 600) return;
  process.stdout.write(adviceJSON('PostToolUse', `PR created: ${match[0]}\nReview: gh pr review ${match[2]} --repo ${match[1]}`));
});
