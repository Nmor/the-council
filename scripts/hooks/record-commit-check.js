#!/usr/bin/env node
// Size budget: 8 KB. Check: token-budget.mjs --check.
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { git, commitInfo } = require('./lib/committed-proof.js');
const { materialize } = require('./lib/committed-snapshot.js');

function record(argv) {
  const kind = argv.shift();
  if (!['gate', 'coverage'].includes(kind)) throw new Error('expected gate or coverage; a command cannot earn a review');
  const selected = argv[0] === '--commit' ? (argv.shift(), argv.shift()) : 'HEAD';
  if (argv.shift() !== '--' || !argv.length) throw new Error('expected -- followed by the required check command');
  const root = git(process.cwd(), ['rev-parse', '--show-toplevel']);
  const commit = git(root, ['rev-parse', '--verify', '--end-of-options', `${selected}^{commit}`]);
  const info = commitInfo(root, commit);
  const folder = path.join(root, '.council', 'proofs', 'commits', commit);
  fs.mkdirSync(folder, { recursive: true, mode: 0o700 });
  const lock = path.join(folder, 'recording.lock');
  fs.mkdirSync(lock, { mode: 0o700 });
  try { return checkCommitted(root, commit, info, folder, kind, argv); }
  finally { fs.rmdirSync(lock); }
}

function checkCommitted(root, commit, info, folder, kind, argv) {
  const receipt = path.join(folder, 'gate.json');
  let previous = null;
  if (fs.existsSync(receipt)) {
    previous = JSON.parse(fs.readFileSync(receipt, 'utf8'));
    fs.unlinkSync(receipt);
    if (previous.commit !== commit || previous.tree !== info.tree || !Array.isArray(previous.checks) || previous.exit_code !== 0)
      previous = null;
  }
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'council-commit-check-'));
  fs.chmodSync(scratch, 0o700);
  try {
    const source = path.join(scratch, 'source');
    fs.mkdirSync(source, { mode: 0o700 });
    materialize(root, commit, source);
    const env = { ...process.env };
    for (const name of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE']) delete env[name];
    const result = spawnSync(argv[0], argv.slice(1), {
      cwd: source, env, encoding: 'utf8', timeout: 3600000, maxBuffer: 32 * 1024 * 1024,
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.error || result.signal || result.status !== 0) {
      process.stderr.write('[council-record] check failed; successful receipt invalidated\n');
      return Number.isInteger(result.status) && result.status > 0 ? result.status : 1;
    }
    const coverage = kind === 'coverage' ? measuredCoverage(result.stdout + result.stderr) : previous?.coverage;
    const digest = crypto.createHash('sha256').update(JSON.stringify(argv)).digest('hex');
    const check = { command: `${path.basename(argv[0])} [argv sha256:${digest}]`, command_digest: digest, exit_code: 0 };
    const proof = { commit, tree: info.tree, at: Date.now(), exit_code: 0,
      checks: [...(previous?.checks || []), check], ...(coverage === undefined ? {} : { coverage }) };
    const temporary = path.join(folder, `gate-${crypto.randomUUID()}.tmp`);
    try {
      fs.writeFileSync(temporary, JSON.stringify(proof, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
      fs.renameSync(temporary, receipt);
    } finally { fs.rmSync(temporary, { force: true }); }
    process.stdout.write(`[council-record] post-commit ${kind} recorded for ${commit}\n`);
    return 0;
  } finally { fs.rmSync(scratch, { recursive: true, force: true }); }
}

function measuredCoverage(output) {
  const values = [...output.matchAll(/coverage:\s*(\d+(?:\.\d+)?)%|all files\s*\|\s*(\d+(?:\.\d+)?)/gi)]
    .map(match => Number(match[1] ?? match[2]));
  if (!values.length || values.some(value => !Number.isFinite(value) || value < 0 || value > 100))
    throw new Error('coverage command returned no supported measured percentage');
  return Math.min(...values);
}

try { process.exitCode = record(process.argv.slice(2)); }
catch (error) {
  process.stderr.write(`[council-record] ${error.message}\n`);
  process.exitCode = 1;
}
