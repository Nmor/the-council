#!/usr/bin/env node
// Size budget: 4 KB. Check: token-budget.mjs --check.
'use strict';
const { readInput } = require('./lib/lifecycle-context.js');
const { appendAudit } = require('./lib/audit-state.js');

readInput('permission-denied-audit', input => {
  try {
    appendAudit('bypass-log.jsonl', {
      ts: new Date().toISOString(),
      event: 'permission.denied',
      session_id: input.session_id || null,
      tool: input.tool_name || null,
      cwd: input.cwd || null,
      detail: input.reason || input.message || '',
    });
  } catch (error) {
    process.stderr.write(`[audit] record unavailable: ${error.code || 'unsafe state'}\n`);
  }
}, new Set(['PermissionDenied']));
