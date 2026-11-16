#!/usr/bin/env node
// Size budget: 8 KB. Check: token-budget.mjs --check.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { git } = require('./hooks/lib/committed-proof.js');
const LEGACY_MARKER = '# Council post-commit publication gate';
const MARKER = `${LEGACY_MARKER} v2`;

function quote(value) { return "'" + value.replaceAll("'", "'\\''") + "'"; }

function refreshLauncher(file, current, entry) {
  const lines = current.split('\n');
  const launchers = lines.flatMap((line, index) =>
    /^printf '%s' "\$council_push_input" \| node .+ "\$@" \|\| exit 1$/.test(line) ? [index] : []);
  if (launchers.length !== 1)
    throw new Error(`unrecognized Council v2 hook; preserve and integrate explicitly: ${file}`);
  lines[launchers[0]] = `printf '%s' "$council_push_input" | node ${quote(entry)} "$@" || exit 1`;
  const contents = lines.join('\n');
  if (contents !== current) {
    const temporary = `${file}.council-${crypto.randomUUID()}.tmp`;
    try {
      fs.writeFileSync(temporary, contents, { mode: 0o755, flag: 'wx' });
      fs.renameSync(temporary, file);
    } finally { fs.rmSync(temporary, { force: true }); }
  }
  fs.chmodSync(file, 0o755);
  return file;
}

function installAt(hooks, entry) {
  fs.mkdirSync(hooks, { recursive: true });
  const file = path.join(hooks, 'pre-push');
  const previous = `${file}.before-council`;
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (current.split('\n')[1] === MARKER) return refreshLauncher(file, current, entry);
  const legacy = current.split('\n')[1] === LEGACY_MARKER;
  const original = legacy ? previous : file;
  const bytes = fs.existsSync(original) ? fs.readFileSync(original) : Buffer.alloc(0);
  const old = bytes.toString('utf8');
  const enabled = fs.existsSync(original) && Boolean(fs.statSync(original).mode & 0o111);
  if (enabled && (!Buffer.from(old).equals(bytes) || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(old)))
    throw new Error(`unsupported binary hook; preserve and integrate explicitly: ${file}`);
  const first = old.split('\n')[0];
  if (enabled && first.startsWith('#!') && !/\b(?:ba|da|k|z)?sh(?:\s|$)/.test(first))
    throw new Error(`unsupported existing non-shell hook; preserve and integrate explicitly: ${file}`);
  const shebang = enabled && first.startsWith('#!') ? first : '#!/bin/sh';
  const body = enabled ? (first.startsWith('#!') ? old.slice(first.length + 1) : old) : '';
  // Keep the original body at its original path: Husky and other hooks use $0
  // to locate siblings or select their hook name.
  const contents = `${shebang}\n${MARKER}
council_push_input=$(cat && printf .) || exit 1
council_push_input=\${council_push_input%.}
printf '%s' "$council_push_input" | node ${quote(entry)} "$@" || exit 1
printf '%s' "$council_push_input" | {
  unset council_push_input
  :
${body}
}
`;
  const temporary = `${file}.council-${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, contents, { mode: 0o755, flag: 'wx' });
    fs.chmodSync(temporary, 0o755);
    if (old && !legacy) {
      if (fs.existsSync(previous)) {
        if (!fs.readFileSync(previous).equals(fs.readFileSync(file)))
          throw new Error(`refusing to overwrite retained hook: ${previous}`);
      } else fs.copyFileSync(file, previous, fs.constants.COPYFILE_EXCL);
    }
    fs.renameSync(temporary, file);
  } finally { fs.rmSync(temporary, { force: true }); }
  return file;
}

function install(root, entry = path.join(__dirname, 'hooks', 'committed-push-gate.js')) {
  const configured = spawnSync('git', ['-C', root, 'config', '--path', '--get', 'core.hooksPath'], {
    encoding: 'utf8', timeout: 10000,
  });
  if (configured.error || configured.signal || ![0, 1].includes(configured.status))
    throw new Error('cannot resolve the active Git hooks path');
  const configuredPath = configured.status === 0 ? configured.stdout.trim() : '';
  if (configured.status === 0 && !configuredPath)
    throw new Error('configured Git hooks path is empty');
  const hooks = configuredPath
    ? path.resolve(root, configuredPath)
    : path.resolve(root, git(root, ['rev-parse', '--git-path', 'hooks']));
  const exclude = path.resolve(root, git(root, ['rev-parse', '--git-path', 'info/exclude']));
  fs.mkdirSync(path.dirname(exclude), { recursive: true });
  const old = fs.existsSync(exclude) ? fs.readFileSync(exclude, 'utf8') : '';
  if (!old.split('\n').includes('.council/proofs/'))
    fs.appendFileSync(exclude, `${old.endsWith('\n') || !old ? '' : '\n'}.council/proofs/\n`);
  return installAt(hooks, entry);
}

if (require.main === module) {
  try {
    const roots = process.argv.slice(2);
    if (!roots.length) throw new Error('usage: install-commit-workflow.js <repo> [<repo>...]');
    for (const root of roots) process.stdout.write(`${install(path.resolve(root))}\n`);
  } catch (error) {
    process.stderr.write(`[council-install] ${error.message}\n`);
    process.exitCode = 1;
  }
}
module.exports = { install, installAt };
