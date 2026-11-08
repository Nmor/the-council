#!/usr/bin/env node
// Size budget: 4 KB. Check: token-budget.mjs --check.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { readInput } = require('./lib/lifecycle-context.js');
const { record, terminalSuccess, checkInvocation, invalidate } = require('./lib/verification.js');
const COVERAGE = [/go\s+test[^|]*-cover/i, /go\s+tool\s+cover/i, /vitest[^|]*--coverage/i,
  /jest[^|]*--coverage/i, /pytest[^|]*--cov/i, /coverage\s+report/i, /cargo\s+tarpaulin/i,
  /dotnet\s+test[^|]*collect.*coverage/i, /phpunit[^|]*--coverage/i, /\b(nyc|c8)\b/i,
  /\b(npm|pnpm|yarn|bun)\s+(run\s+)?\S*coverage\b/i];
const PERCENTS = [/total:\s*\(statements\)\s*([0-9.]+)%/i,
  /coverage:\s*([0-9.]+)%\s*of\s*statements/i, /Statements\s*:\s*([0-9.]+)%/i,
  /All files\s*\|\s*([0-9.]+)/i, /TOTAL\s+\d+\s+\d+\s+([0-9.]+)%/i];
const TAIL_BYTES = 256 * 1024;

// The end of output Claude Code saved to a file: stdout then keeps only the head, and a
// coverage summary prints last.
function persistedTail(file) {
  if (typeof file !== 'string' || !path.isAbsolute(file)) return '';
  try {
    const fd = fs.openSync(file, 'r');
    try {
      const size = fs.fstatSync(fd).size;
      const buffer = Buffer.alloc(Math.min(size, TAIL_BYTES));
      fs.readSync(fd, buffer, 0, buffer.length, size - buffer.length);
      return buffer.toString('utf8');
    } finally {
      fs.closeSync(fd);
    }
  } catch (error) {
    process.stderr.write(`[test-coverage-marker] saved output unreadable: ${error.code || error.message}\n`);
    return '';
  }
}

readInput('test-coverage-marker', input => {
  const command = input.tool_input?.command || input.tool_input?.cmd || '';
  if (input.tool_name !== 'Bash' || !COVERAGE.some(expression => expression.test(command))) return;
  invalidate(input, 'coverage');
  if (!checkInvocation(command) || !terminalSuccess(input.tool_response, input.hook_event_name)) return;
  const response = input.tool_response;
  // Claude Code's Bash result is stdout/stderr, with long output saved to persistedOutputPath;
  // other runtimes carry text in content blocks or output. Read every one.
  const blocks = Array.isArray(response.content)
    ? response.content.map(block => block && block.text).filter(value => typeof value === 'string')
    : [];
  const output = [response.stdout, response.stderr, response.output, ...blocks,
    persistedTail(response.persistedOutputPath)]
    .filter(value => typeof value === 'string').join('\n');
  for (const expression of PERCENTS) {
    const match = expression.exec(output);
    if (!match) continue;
    const measured = Number(match[1]);
    if (!Number.isFinite(measured) || measured < 0 || measured > 100) return;
    const written = record(input, measured);
    if (!written) process.stderr.write('[test-coverage-marker] proof unavailable\n');
    return;
  }
});
