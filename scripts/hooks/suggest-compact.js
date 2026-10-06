#!/usr/bin/env node
// Size budget: 8 KB. Check: wc -c; gate: token-budget.mjs --check.
/**
 * Strategic Compact Suggester
 *
 * Cross-platform (Windows, macOS, Linux)
 *
 * Runs on PreToolUse or periodically to suggest manual compaction at logical intervals
 *
 * Why manual over auto-compact:
 * - Auto-compact happens at arbitrary points, often mid-task
 * - Strategic compacting preserves context through logical phases
 * - Compact after exploration, before execution
 * - Compact after completing a milestone, before starting next
 */

const { markerPath, readPrivate, writePrivate } = require('./lib/private-state.js');
const {
  readStdinJson
} = require('../lib/utils');
const { advise } = require('./lib/advise.js');

async function main() {
  // Count per session. Claude Code passes the session id on stdin, not in the
  // environment, so reading only CLAUDE_SESSION_ID put every session on the machine
  // on one shared `default` counter.
  const input = await readStdinJson();
  const sessionId = input.session_id || process.env.CLAUDE_SESSION_ID || 'default';
  const counterFile = markerPath('tool-count', sessionId);
  const rawThreshold = parseInt(process.env.COMPACT_THRESHOLD || '50', 10);
  const threshold = Number.isFinite(rawThreshold) && rawThreshold > 0 && rawThreshold <= 10000
    ? rawThreshold
    : 50;

  let count = 1;

  try {
    const parsed = Number(readPrivate(counterFile));
    count = Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 1000000 ? parsed + 1 : 1;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  // Advisory count is approximate under concurrent tool invocations.
  writePrivate(counterFile, String(count));

  // Suggest compact after threshold tool calls
  if (count === threshold) {
    advise(input, `[StrategicCompact] ${threshold} tool calls reached - consider /compact if transitioning phases`);
  }

  // Suggest at regular intervals after threshold (every 25 calls from threshold)
  if (count > threshold && (count - threshold) % 25 === 0) {
    advise(input, `[StrategicCompact] ${count} tool calls - good checkpoint for /compact if context is stale`);
  }

  process.exit(0);
}

main().catch(() => {
  console.error('[StrategicCompact] Private counter unavailable; no checkpoint claimed.');
  process.exit(0);
});
