#!/usr/bin/env node
// Size budget: 4 KB. Check: token-budget.mjs --check.
'use strict';
const { readInput } = require('./lib/lifecycle-context.js');
const { record, terminalSuccess, checkInvocation, invalidate } = require('./lib/verification.js');
const COVERAGE = [/go\s+test[^|]*-cover/i, /go\s+tool\s+cover/i, /vitest[^|]*--coverage/i,
  /jest[^|]*--coverage/i, /pytest[^|]*--cov/i, /coverage\s+report/i, /cargo\s+tarpaulin/i,
  /dotnet\s+test[^|]*collect.*coverage/i, /phpunit[^|]*--coverage/i, /\b(nyc|c8)\b/i];
const PERCENTS = [/total:\s*\(statements\)\s*([0-9.]+)%/i,
  /coverage:\s*([0-9.]+)%\s*of\s*statements/i, /Statements\s*:\s*([0-9.]+)%/i,
  /All files\s*\|\s*([0-9.]+)/i, /TOTAL\s+\d+\s+\d+\s+([0-9.]+)%/i];

readInput('test-coverage-marker', input => {
  const command = input.tool_input?.command || input.tool_input?.cmd || '';
  if (input.tool_name !== 'Bash' || !COVERAGE.some(expression => expression.test(command))) return;
  invalidate(input, 'coverage');
  if (!checkInvocation(command) || !terminalSuccess(input.tool_response)) return;
  const response = input.tool_response;
  // The documented Bash response carries text in content blocks
  // ({ type: "tool_result", content: [{ type: "text", text }], exit_code });
  // stdout/stderr/output are older harness shapes. Read both (H13).
  const blocks = Array.isArray(response.content)
    ? response.content.map(block => block && block.text).filter(value => typeof value === 'string')
    : [];
  const output = [response.stdout, response.stderr, response.output, ...blocks]
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
