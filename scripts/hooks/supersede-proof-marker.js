#!/usr/bin/env node
// Size budget: 8 KB. Check: wc -c; gate: token-budget.mjs --check.
// PostToolUse hook (matcher: Edit|Write|MultiEdit).
//
// Companion to supersede-proof.js. When an edit lands a durable
// "SUPERSEDE PROOF" comment, record a session marker so a subsequent
// delete in a DIFFERENT file (the common shape: prove it on the
// replacement, then remove the original) is not re-flagged.
//
// The marker is session-scoped and lives in the OS temp dir, so it
// evaporates with the session. Always exits 0.
'use strict';
const { markerPath, writePrivate } = require('./lib/private-state.js');

const PROOF_RE = /SUPERSEDE\s+PROOF/i;

// A proof is a comment on the REPLACEMENT, in code the gate actually polices. Prose that
// merely quotes the phrase is not one — no-bloat.md quotes it in its own rule 6a, so before
// this scope existed, editing the rule that DEMANDS the proof armed a session-wide bypass of
// the hook that ENFORCES it (measured 2026-09-21). Mirrors supersede-proof.js's own skip.
const SRC_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|kts|cs|rb|php|swift)$/i;

function editText(input) {
  const edits = Array.isArray(input.edits) ? input.edits : [];
  return [input.content, input.new_string, ...edits.map((edit) => edit.new_string)]
    .filter((text) => typeof text === 'string').join('\n');
}

let data = '';
process.stdin.on('data', (c) => (data += c));
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data || '{}');
    const ti = input.tool_input || {};
    const sid = input.session_id || '';
    const file = String(ti.file_path || '').toLowerCase();
    if (sid && SRC_EXT.test(file) && !file.includes('/.claude/')) {
      const text = editText(ti);
      if (PROOF_RE.test(text)) {
        const marker = markerPath('supersede-proof', sid);
        writePrivate(marker, String(Date.now()), 'utf8');
      }
    }
  } catch {
    // Marker write is best-effort; a failure only means the next
    // delete gets an extra nudge, which is the safe direction.
  }
  process.exit(0);
});
