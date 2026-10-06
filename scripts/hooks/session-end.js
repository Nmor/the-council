#!/usr/bin/env node
// Size budget: 9 KB. Check: wc -c; gate: token-budget.mjs --check.
/**
 * Stop Hook (Session End) - Persist learnings when session ends
 *
 * Cross-platform (Windows, macOS, Linux)
 *
 * Runs when Claude session ends. Extracts a meaningful summary from
 * the session transcript (via stdin JSON transcript_path) and saves it
 * to a session file for cross-session continuity.
 */

const path = require('path');
const fs = require('fs');
const {
  getSessionsDir,
  getDateString,
  getTimeString,
  getSessionIdShort,
  readFile,
  log
} = require('../lib/utils');
const { pruneSessions, readPrivate, writePrivate } = require('./lib/private-state.js');
const { redact } = require('./lib/redaction.js');

/**
 * Extract a meaningful summary from the session transcript.
 * Reads the JSONL transcript and pulls out key information:
 * - User messages (tasks requested)
 * - Tools used
 * - Files modified
 */
function userText(entry) {
  if (entry.type !== 'user' && entry.role !== 'user' && entry.message?.role !== 'user') return '';
  const content = entry.message?.content ?? entry.content;
  if (typeof content === 'string') return content;
  return Array.isArray(content) ? content.map(block => block?.text || '').join(' ') : '';
}

function rememberTool(entry, tools, files) {
  const name = entry.tool_name || entry.name || '';
  if (name) tools.add(redact(name, 100));
  const file = entry.tool_input?.file_path || entry.input?.file_path;
  if (file && (name === 'Edit' || name === 'Write')) files.add(redact(file, 300));
}

function collectEntry(entry, messages, tools, files) {
  const text = userText(entry).trim();
  if (text) messages.push(redact(text, 200));
  if (entry.type === 'tool_use' || entry.tool_name) rememberTool(entry, tools, files);
  if (entry.type !== 'assistant' || !Array.isArray(entry.message?.content)) return;
  for (const block of entry.message.content) {
    if (block?.type === 'tool_use') rememberTool(block, tools, files);
  }
}

function extractSessionSummary(transcriptPath) {
  const content = readFile(transcriptPath);
  if (!content) return null;
  const lines = content.split('\n').filter(Boolean);
  const messages = [];
  const tools = new Set();
  const files = new Set();
  let errors = 0;
  for (const line of lines) {
    try { collectEntry(JSON.parse(line), messages, tools, files); }
    catch { errors++; }
  }
  if (errors) log(`[SessionEnd] Skipped ${errors}/${lines.length} unparseable transcript lines`);
  if (!messages.length) return null;
  return { userMessages: messages.slice(-10), toolsUsed: [...tools].slice(0, 20),
    filesModified: [...files].slice(0, 30), totalMessages: messages.length };
}

function replaceBlankSummary(content, summary) {
  if (!summary || !content.includes('[Session context goes here]')) return content;
  const start = content.indexOf('## Current State');
  const context = content.indexOf('### Context to Load', start);
  const fence = content.indexOf('```', context);
  const end = content.indexOf('```', fence + 3);
  if (start < 0 || context < 0 || fence < 0 || end < 0) return content;
  return content.slice(0, start) + buildSummarySection(summary) + content.slice(end + 3);
}

// Read hook input from stdin (Claude Code provides transcript_path via stdin JSON)
const MAX_STDIN = 1024 * 1024;
let stdinData = '';
process.stdin.setEncoding('utf8');

process.stdin.on('data', chunk => {
  if (stdinData.length < MAX_STDIN) {
    const remaining = MAX_STDIN - stdinData.length;
    stdinData += chunk.substring(0, remaining);
  }
});

process.stdin.on('end', () => {
  runMain();
});

function runMain() {
  main().catch(err => {
    log(`[SessionEnd] Persistence unavailable: ${err.code || 'unsafe state'}`);
    process.exit(0);
  });
}

async function main() {
  // Parse stdin JSON to get transcript_path
  let transcriptPath = null;
  try {
    const input = JSON.parse(stdinData);
    transcriptPath = input.transcript_path;
  } catch {
    // Fallback: try env var for backwards compatibility
    transcriptPath = process.env.CLAUDE_TRANSCRIPT_PATH;
  }

  const sessionsDir = getSessionsDir();
  const today = getDateString();
  const shortId = getSessionIdShort();
  const sessionFile = path.join(sessionsDir, `${today}-${shortId}-session.tmp`);

  pruneSessions(sessionsDir);

  const currentTime = getTimeString();

  // Try to extract summary from transcript
  let summary = null;

  if (transcriptPath) {
    if (fs.existsSync(transcriptPath)) {
      summary = extractSessionSummary(transcriptPath);
    } else {
      log('[SessionEnd] Transcript not found');
    }
  }

  if (fs.existsSync(sessionFile)) {
    const existing = redact(readPrivate(sessionFile, { allowPublicFile: true }), 1024 * 1024);
    const timestamped = existing.replace(/\*\*Last Updated:\*\*.*/, `**Last Updated:** ${currentTime}`);
    const content = replaceBlankSummary(timestamped, summary);
    writePrivate(sessionFile, content);

    log(`[SessionEnd] Updated session file: ${sessionFile}`);
  } else {
    // Create new session file
    const summarySection = summary
      ? buildSummarySection(summary)
      : `## Current State\n\n[Session context goes here]\n\n### Completed\n- [ ]\n\n### In Progress\n- [ ]\n\n### Notes for Next Session\n-\n\n### Context to Load\n\`\`\`\n[relevant files]\n\`\`\``;

    const template = `# Session: ${today}
**Date:** ${today}
**Started:** ${currentTime}
**Last Updated:** ${currentTime}

---

${summarySection}
`;

    writePrivate(sessionFile, template);
    log(`[SessionEnd] Created session file: ${sessionFile}`);
  }

  process.exit(0);
}

function buildSummarySection(summary) {
  let section = '## Session Summary\n\n';

  // Tasks (from user messages — collapse newlines and escape backticks to prevent markdown breaks)
  section += '### Tasks\n';
  for (const msg of summary.userMessages) {
    section += `- ${msg.replace(/\n/g, ' ').replace(/`/g, '\\`')}\n`;
  }
  section += '\n';

  // Files modified
  if (summary.filesModified.length > 0) {
    section += '### Files Modified\n';
    for (const f of summary.filesModified) {
      section += `- ${f}\n`;
    }
    section += '\n';
  }

  // Tools used
  if (summary.toolsUsed.length > 0) {
    section += `### Tools Used\n${summary.toolsUsed.join(', ')}\n\n`;
  }

  section += `### Stats\n- Total user messages: ${summary.totalMessages}\n`;

  return section;
}

