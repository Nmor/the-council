// Size budget: 4 KB. Check: token-budget.mjs --check.
'use strict';

const ASSIGNMENT = /\b([a-z_][\w.-]{0,127})["']?[ \t]{0,32}[:=][ \t]{0,32}/gi;
const OPTION = /--([a-z_][\w.-]{0,127})[ \t]{1,32}/gi;
const SENSITIVE_KEY = /password|passwd|secret|token|api[_-]?key|access[_-]?key/i;
const PRIVATE_KEY = /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g;
const AUTHORIZATION = /\b(Bearer|Basic)\s+[a-z\d._~+/=-]+/gi;
const TOKENS = [/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
  /\b(?:ghp_|github_pat_|sk-)[A-Za-z0-9_-]{12,}\b/g,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g];

function assignmentEnd(text, start) {
  let quote = '';
  let i = start;
  for (; i < text.length; i++) {
    const character = text.charAt(i);
    if (character === '\\') {
      i += text.slice(i + 1, i + 3) === '\r\n' ? 2 : 1;
      continue;
    }
    if (quote) {
      if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (/[\s,;]/.test(character)) return i;
  }
  return i;
}

function redactAssignments(text) {
  let output = '';
  let cursor = 0;
  const matches = [...text.matchAll(ASSIGNMENT), ...text.matchAll(OPTION)].sort((a, b) => a.index - b.index);
  for (const match of matches) {
    if (match.index < cursor || !SENSITIVE_KEY.test(match[1])) continue;
    output += text.slice(cursor, match.index) + `${match[1]}=[REDACTED]`;
    cursor = assignmentEnd(text, match.index + match[0].length);
  }
  return output + text.slice(cursor);
}

function redact(value, limit = 300) {
  let text = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  text = redactAssignments(text.replace(PRIVATE_KEY, '[REDACTED PRIVATE KEY]'));
  text = text.replace(AUTHORIZATION, '$1 [REDACTED]');
  for (const expression of TOKENS) text = text.replace(expression, '[REDACTED]');
  return text.replace(/([a-z][a-z\d+.-]{0,31}:\/\/)[^\s/@:]+:[^\s/@]+@/gi, '$1[REDACTED]@').slice(0, limit);
}

module.exports = { redact };
