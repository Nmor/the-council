#!/usr/bin/env node
// Size budget: 8 KB. Check: wc -c; gate: token-budget.mjs --check.
// PreToolUse hook (matcher: Edit|Write).
// NON-BLOCKING nudge: when integration-shaped SOURCE is edited and no online
// research ran this session, add a one-line reminder next to the tool result
// (lib/advise.js; stderr on exit 0 is never shown). Always exits 0 —
// it never blocks an edit (false-positive risk on a hard block is too high).
// Pairs with council-default.md rule 11 + verify-before-claim.md done-gate;
// the research-marker PostToolUse hook clears it once WebSearch/WebFetch runs.
'use strict';
const { markerPath, hasPrivate } = require('./lib/private-state.js');
const path = require('path');

// Source-code extensions only (skip docs/config).
const SRC_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|kts|cs|rb|php|swift)$/i;
// Integration signals: external-contract code where currency matters.
const INTEGRATION_PATTERNS = [
  /(\/integrations?\/|\/providers?\/|\/clients?\/|webhook|oauth|[-_]client\b|[-_]sdk\b|api[-_]?client)/i,
  /(stripe|twilio|paystack|flutterwave|sendgrid|\bses\b|\bfcm\b|\bapns\b|plaid|slack|clickup|graphql|grpc|calendar|msgraph)/i,
];
// Platform surfaces are external contracts too: CI workflows, container builds
// and cluster manifests run against documented runner/OS/scheduler behavior.
// Three Windows CI rounds (CRLF, cp1252, path separators) were each a
// documented platform fact none of the provider patterns matched (2026-10-06).
const PLATFORM_PATTERNS = [
  /\/\.github\/workflows\/[^/]+\.ya?ml$/i,
  /(^|\/)dockerfile([^/]*)$/i,
  /docker-compose[^/]*\.ya?ml$/i,
  /(\/k8s\/|\/kustomiz|\/charts?\/|\/manifests?\/).*\.ya?ml$/i,
];
const INTEGRATION = { test: (file) => INTEGRATION_PATTERNS.some((pattern) => pattern.test(file)) };
const PLATFORM = { test: (file) => PLATFORM_PATTERNS.some((pattern) => pattern.test(file)) };

const { advise } = require('./lib/advise.js');

let data = '';
process.stdin.on('data', (c) => (data += c));
process.stdin.on('end', () => {
  let warn = null;
  let input = {};
  try {
    input = JSON.parse(data || '{}');
    const file = (input.tool_input && input.tool_input.file_path) || '';
    const sid = input.session_id || '';
    if (file && sid) {
      const p = file.toLowerCase();
      const marker = markerPath('research', sid);
      const framework = p.includes('/.claude/'); // skip framework config / rules / agents
      const integrationSource = !framework && SRC_EXT.test(p) && INTEGRATION.test(p);
      const platformSource = !framework && PLATFORM.test(p);
      if ((integrationSource || platformSource) && !hasPrivate(marker)) {
        const kind = integrationSource ? 'integration' : 'platform';
        const docs = integrationSource
          ? 'current provider docs (versions, breaking changes, auth) and validate the payload shape'
          : 'current platform docs (runner images, OS defaults such as text encoding, schema of the workflow/manifest) at the pinned version';
        warn =
          `[research-gate] Editing ${kind}-shaped file "${path.basename(file)}" ` +
          `without online research this session. Per council-default.md rule 11 and ` +
          `official-docs-first.md, read the ${docs} before finalizing.`;
      }
    }
  } catch (err) {
    warn = `[research-gate] skipped: ${err.message}`;
  }
  advise(input, warn);
  process.exit(0); // never block
});
