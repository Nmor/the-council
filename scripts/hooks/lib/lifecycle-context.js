// Size budget: 6 KB. Check: wc -c; gate: token-budget.mjs --check.
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const pc = require('./project-context.js');

const MAX_INPUT_BYTES = 1024 * 1024;
const MAX_CONTEXT_BYTES = 2048;
const EVENTS = new Set(['SessionStart', 'PreCompact', 'PostToolUse']);

function bounded(text, limit = MAX_CONTEXT_BYTES) {
  const buffer = Buffer.from(text);
  if (buffer.length <= limit) return text;
  return buffer.subarray(0, limit - 4).toString('utf8').replace(/\uFFFD$/, '') + '…';
}

function adviceJSON(event, text) {
  if (!EVENTS.has(event)) throw new Error('unsupported hook event');
  let output;
  let limit = MAX_CONTEXT_BYTES;
  do {
    output = JSON.stringify({ hookSpecificOutput: {
      hookEventName: event, additionalContext: bounded(text.trim(), limit),
    } }) + '\n';
    limit -= 128;
  } while (Buffer.byteLength(output) > MAX_CONTEXT_BYTES);
  return output;
}

function readInput(label, handler, allowedEvents = EVENTS) {
  const chunks = [];
  let bytes = 0;
  let failed = false;
  process.stdin.on('data', chunk => {
    bytes += chunk.length;
    if (bytes <= MAX_INPUT_BYTES) chunks.push(chunk);
  });
  process.stdin.on('error', error => {
    failed = true;
    process.stderr.write(`[${label}] skipped: ${error.code || 'stdin error'}\n`);
  });
  process.stdin.on('end', () => {
    if (failed) return;
    try {
      if (bytes > MAX_INPUT_BYTES) throw new Error('input exceeds 1 MiB');
      const input = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('expected JSON object');
      if (input.cwd !== undefined && (typeof input.cwd !== 'string' || !input.cwd)) throw new Error('invalid cwd');
      if (input.session_id !== undefined && typeof input.session_id !== 'string') throw new Error('invalid session ID');
      if (input.hook_event_name !== undefined && !allowedEvents.has(input.hook_event_name)) throw new Error('invalid hook event');
      handler(input);
    } catch (error) {
      process.stderr.write(`[${label}] skipped: ${bounded(error.code || error.message, 300)}\n`);
    }
  });
}

function context(input, home = os.homedir()) {
  const cwd = input.cwd || process.cwd();
  const root = pc.projectRoot(cwd);
  const projectHash = createHash('sha256').update(root).digest('hex').slice(0, 24);
  const key = `${pc.projectKey(root).slice(0, 120)}-${projectHash}`;
  const id = createHash('sha256').update(input.session_id || 'unidentified').digest('hex').slice(0, 24);
  const dir = path.join(home, '.claude', 'projects', key, 'council');
  const index = path.join(pc.memoryDir(cwd, home), 'MEMORY.md');
  const plan = pc.activePlan(cwd, home);
  return { root, id, dir, home, index, plan, brief: path.join(dir, `${id}-precompact-brief.md`) };
}

function writeBrief(state, text) {
  let parent = state.home;
  for (const part of path.relative(state.home, state.dir).split(path.sep)) {
    parent = path.join(parent, part);
    try {
      const stat = fs.lstatSync(parent);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('unsafe checkpoint directory');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      fs.mkdirSync(parent, { mode: 0o700 });
    }
  }
  try {
    const stat = fs.lstatSync(state.brief);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('unsafe checkpoint file');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const temporary = path.join(state.dir, `${randomUUID()}.tmp`);
  const descriptor = fs.openSync(temporary, fs.constants.O_WRONLY | fs.constants.O_CREAT |
    fs.constants.O_EXCL, 0o600);
  try {
    try {
      fs.writeFileSync(descriptor, bounded(text));
    } finally {
      fs.closeSync(descriptor);
    }
    fs.renameSync(temporary, state.brief);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

function pointers(state) {
  const targets = [];
  if (state.plan.state === 'set') targets.push(`Active plan: ${bounded(state.plan.path, 600)}`);
  if (fs.existsSync(state.index)) targets.push(`Memory index (lookup only if needed): ${bounded(state.index, 600)}`);
  return targets;
}

module.exports = { adviceJSON, bounded, context, pointers, readInput, writeBrief, MAX_CONTEXT_BYTES };
