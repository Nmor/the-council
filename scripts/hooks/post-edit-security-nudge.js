#!/usr/bin/env node
// PostToolUse Edit|Write|MultiEdit (via dispatch.js): inline security nudges.
// Rules merged 2026-11-15 from the security-guidance plugin's patterns.py
// (claude-plugins-official, reminder text preserved verbatim) so the
// while-editing lane is Council-native. Advisory and fail-open; exception
// handling follows overrides-not-exceptions.md, never inline comments.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, 'lib/security-nudge-rules.json'), 'utf8'));
const CLASS = {
  js: p => /\.(js|jsx|ts|tsx|mjs|cjs|mts|cts|vue|svelte)$/.test(p),
  py: p => /\.(py|pyi|ipynb)$/.test(p),
  doc: p => /\.(md|mdx|txt|rst|json|yaml|yml)$/.test(p),
  gha: p => p.includes('.github/workflows/') && /\.(yml|yaml)$/.test(p),
  yaml: p => /\.(yml|yaml)$/.test(p),
  go: p => /\.go$/.test(p),
  sh: p => /\.(sh|bash|zsh)$/.test(p),
  rb: p => /\.rb$/.test(p),
  php: p => /\.php$/.test(p),
  java: p => /\.(java|kt|kts)$/.test(p),
  rs: p => /\.rs$/.test(p),
  c: p => /\.(c|h|cpp|cc|hpp)$/.test(p),
  sql: p => /\.sql$/.test(p),
  tf: p => /\.tf$/.test(p),
  html: p => /\.(html|htm)$/.test(p),
  env: p => /(^|\/)\.env(\.|$)/.test(p),
  docker: p => /(^|\/)(Dockerfile|Containerfile)/.test(p),
};
// prose docs quoting code must not trip pattern-only rules (review M4)
const DOC = p => /\.(md|mdx|txt|rst)$/.test(p);

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => { input += c; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const ti = data.tool_input || {};
    const file = ti.file_path || '';
    const text = [ti.content, ti.new_string, ...(ti.edits || []).map(e => e.new_string)]
      .filter(Boolean).join('\n');
    if (!file || !text) return process.exit(0);
    const hits = [];
    for (const r of RULES) {
      if (r.pathClasses && !r.pathClasses.some(c => CLASS[c] && CLASS[c](file))) continue;
      if (!r.pathClasses && DOC(file)) continue;
      // match = any substring hit OR regex hit (parity with upstream semantics)
      const subHit = r.substrings && r.substrings.some(s => text.includes(s));
      let reHit = false;
      if (!subHit && r.regex) {
        try { reHit = new RegExp(r.regex).test(text); } catch { reHit = false; }
      }
      // a rule with no pattern is path-triggered (e.g. any workflow edit)
      if ((r.substrings || r.regex) && !subHit && !reHit) continue;
      hits.push(r);
      if (hits.length >= 2) break; // cap noise per edit
    }
    if (!hits.length) return process.exit(0);
    process.stdout.write(JSON.stringify({ hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: '[security-nudge] ' + hits.map(h => h.reminder).join('\n\n---\n\n') +
        '\n\n(Exceptions go through overrides-not-exceptions.md with an owner and expiry — never an inline comment.)',
    } }));
  } catch { /* fail open */ }
  process.exit(0);
});
process.stdin.on('error', () => process.exit(0));
