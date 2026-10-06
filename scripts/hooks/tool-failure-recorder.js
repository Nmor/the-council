#!/usr/bin/env node
// Size budget: 4 KB. Check: token-budget.mjs --check.
'use strict';
const { readInput } = require('./lib/lifecycle-context.js');
const { appendAudit } = require('./lib/audit-state.js');

readInput('tool-failure-recorder', input => {
  try {
    appendAudit('tool-failures.jsonl', {
      ts: new Date().toISOString(),
      session_id: input.session_id || null,
      tool: input.tool_name || null,
      cwd: input.cwd || null,
      error: input.error || input.tool_response || '',
    });
  } catch (error) {
    process.stderr.write(`[audit] record unavailable: ${error.code || 'unsafe state'}\n`);
  }
}, new Set(['PostToolUseFailure']));
