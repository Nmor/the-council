#!/usr/bin/env node
// Size budget: 11 KB. Check: wc -c; gate: token-budget.mjs --check.
'use strict';
const { bounded, context, pointers, readInput, writeBrief } = require('./lib/lifecycle-context.js');

// PreCompact cannot inject instructions into the model. Save a bounded pointer
// record; never append to another session's export or copy memory/learning history.
if (process.env.CLAUDE_COUNCIL_BRIEF !== 'off') {
  readInput('pre-compact-brief', input => {
    const state = context(input);
    const planNote = state.plan.state === 'set' ? '' : `Active plan state: ${state.plan.state}`;
    const brief = bounded([
      '# Council compaction checkpoint',
      `Updated: ${new Date().toISOString()}`,
      `Project: ${bounded(state.root, 400)}`,
      `Session key: ${state.id}`,
      ...pointers(state), planNote,
      'Continue from the conversation summary. Read only the current handoff and relevant sections if details are missing.',
      'Verification, decisions and next action belong in the existing authoritative plan; this hook does not certify or update them.',
      '',
    ].filter(line => line !== '').join('\n') + '\n');
    writeBrief(state, brief);
  });
}
