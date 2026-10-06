// Size budget: 8 KB. Check: token-budget.mjs --check.
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { privateDirectory, readPrivate, writePrivate } = require('./private-state.js');
const { redact } = require('./redaction.js');

const MAX_BYTES = 1024 * 1024;
const MAX_AGE = 30 * 24 * 60 * 60 * 1000;
const PAUSE = new Int32Array(new SharedArrayBuffer(4));

function acquire(lock) {
  const until = Date.now() + 500;
  for (;;) {
    try {
      fs.mkdirSync(lock, { mode: 0o700 });
      return;
    } catch (error) {
      if (error.code !== 'EEXIST' || Date.now() >= until) throw error;
      Atomics.wait(PAUSE, 0, 0, 10);
    }
  }
}

function retained(file) {
  let text;
  try { text = readPrivate(file, { allowPublicFile: true }); }
  catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  return text.split('\n').filter(Boolean).map(line => JSON.parse(line)).filter(row => {
    const age = Date.now() - Date.parse(row.ts);
    return Number.isFinite(age) && age >= 0 && age <= MAX_AGE;
  }).map(row => JSON.stringify(safeRow(row)));
}

function safeRow(row) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) =>
    [key, value === null ? null : redact(value)]));
}

function appendAudit(name, row) {
  if (!['bypass-log.jsonl', 'tool-failures.jsonl'].includes(name)) throw new Error('invalid audit name');
  const directory = privateDirectory(path.join(os.homedir(), '.claude', 'audits'));
  const file = path.join(directory, name);
  const lock = `${file}.lock`;
  acquire(lock);
  try {
    const lines = [...retained(file), JSON.stringify(safeRow(row))];
    while (Buffer.byteLength(lines.join('\n')) > MAX_BYTES && lines.length > 1) lines.shift();
    writePrivate(file, lines.join('\n') + '\n');
  } finally {
    fs.rmdirSync(lock);
  }
}

module.exports = { appendAudit };
