#!/usr/bin/env node
// Size budget: 4 KB. Check: token-budget.mjs --check.
'use strict';
const { readInput } = require('./lib/lifecycle-context.js');
const { record } = require('./lib/verification.js');

readInput('gate-marker', input => {
  const written = record(input);
  if (!written) return;
});
