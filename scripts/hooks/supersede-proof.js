#!/usr/bin/env node
// Size budget: 8 KB. Check: wc -c; gate: token-budget.mjs --check.
// PreToolUse hook (matcher: Edit|Write|MultiEdit).
//
// Enforces `no-bloat.md` rule 6a + `wiring-and-usage-review.md` rule 9:
// a deletion justified by "something newer replaces it" is only legal once
// the replacement is PROVEN to carry every capability the deleted code had.
//
// What it catches: an Edit whose old_string removes a whole function /
// method / handler / exported symbol and whose new_string does NOT add an
// equivalent one — i.e. a net removal — in a session where a same-file or
// same-package replacement landed. That is the supersede shape. The hook
// then requires a SUPERSEDE PROOF marker to be present somewhere in the
// change (the replacement's comment) or in the session's proof marker file.
//
// NON-BLOCKING by default (exit 0, advice via lib/advise.js) because a hard block
// on a heuristic carries too much false-positive cost mid-refactor.
// Set CLAUDE_SUPERSEDE_PROOF=block to hard-block (exit 2) instead;
// CLAUDE_SUPERSEDE_PROOF=off disables it entirely.
'use strict';
const { markerPath, hasPrivate } = require('./lib/private-state.js');
const path = require('path');

const MODE = (process.env.CLAUDE_SUPERSEDE_PROOF || 'warn').toLowerCase();

// Source extensions only — prose/config deletions are not supersedes.
const SRC_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|kts|cs|rb|php|swift)$/i;

// Declaration shapes across the languages this workspace uses. A removal of
// one of these from old_string is a candidate supersede.
const DECL_PATTERNS = [
  /^func [A-Z_a-z]\w* *\(/,
  /^func \([^)]*\) [A-Z_a-z]\w* *\(/,
  /^(?:export )?(?:async )?function [\w$]+ *[<(]/,
  /^export (?:const|class|interface|type) [\w$]+/,
  /^def \w+ *\(/,
  /^(?:pub )?fn \w+ *[<(]/,
];
const ACCESS = new Set(['public', 'private', 'protected', 'internal']);

// The durable proof marker the rule asks for.
const PROOF_RE = /SUPERSEDE\s+PROOF/i;

function countDecls(text) {
  return String(text || '').split('\n').reduce((count, raw) => {
    const line = raw.trim().replace(/\s+/g, ' ');
    const tokens = line.split('(')[0].split(' ');
    const method = line.includes('(') && ACCESS.has(tokens[0]) && tokens.length >= 3;
    return count + Number(method || DECL_PATTERNS.some((pattern) => pattern.test(line)));
  }, 0);
}

function editParts(input) {
  if (typeof input.old_string === 'string') {
    return { removed: input.old_string, added: typeof input.new_string === 'string' ? input.new_string : '' };
  }
  const edits = Array.isArray(input.edits) ? input.edits : [];
  return {
    removed: edits.map((edit) => edit.old_string).filter((text) => typeof text === 'string').join('\n'),
    added: edits.map((edit) => edit.new_string).filter((text) => typeof text === 'string').join('\n'),
  };
}

function removalCount(input, file, sid) {
  const lower = String(file).toLowerCase();
  if (!file || lower.includes('/.claude/') || !SRC_EXT.test(lower) ||
      /(_test\.|\.test\.|\.spec\.|\/tests?\/|_spec\.)/.test(lower)) return 0;
  const { removed, added } = editParts(input);
  const delta = countDecls(removed) - countDecls(added);
  if (delta <= 0 || PROOF_RE.test(added) || PROOF_RE.test(removed)) return 0;
  if (sid && hasPrivate(markerPath('supersede-proof', sid))) return 0;
  return delta;
}

const { advise } = require('./lib/advise.js');

let data = '';
process.stdin.on('data', (c) => (data += c));
process.stdin.on('end', () => {
  if (MODE === 'off') process.exit(0);

  let warn = null;
  try {
    const input = JSON.parse(data || '{}');
    const ti = input.tool_input || {};
    const file = ti.file_path || '';
    const sid = input.session_id || '';
    const n = removalCount(ti, file, sid);
    if (n > 0) {
      warn =
            `[supersede-proof] Net removal of ${n} declaration(s) from ` +
            `"${path.basename(file)}" with no SUPERSEDE PROOF in the change.\n` +
            `[supersede-proof] Per no-bloat.md rule 6a + wiring-and-usage-review.md rule 9: ` +
            `if a newer impl replaces this, PROVE the replacement carries forward every ` +
            `INPUT, OUTPUT (field-by-field), ERROR BRANCH, SIDE EFFECT (audit/metric/cache/notify) ` +
            `and GUARD (authz/ownership/rate-limit/idempotency) the deleted path had — and that ` +
            `every consumer is migrated in this same change and the tests moved.\n` +
            `[supersede-proof] "Newer" is not "better". If any axis fails, EXTEND the ` +
            `replacement until it genuinely covers the original, or deprecate on a window ` +
            `instead of deleting.\n` +
            `[supersede-proof] Record it as a "SUPERSEDE PROOF" comment on the replacement ` +
            `+ a "Supersede proof" line in the verification block.\n` +
            `[supersede-proof] Modes: CLAUDE_SUPERSEDE_PROOF=block | warn (default) | off`;
    }
  } catch (err) {
    warn = `[supersede-proof] skipped: ${err.message}`;
  }

  if (warn && MODE === 'block' && !/skipped:/.test(warn)) {
    process.stderr.write(warn + '\n');
    process.exit(2);
  }
  let input = {};
  try {
    input = JSON.parse(data || '{}');
  } catch {
    input = {};
  }
  advise(input, warn);
  process.exit(0);
});
