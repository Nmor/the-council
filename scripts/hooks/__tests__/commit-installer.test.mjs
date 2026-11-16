// Size budget: 8 KB. Check: token-budget.mjs --check.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, cpSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import installer from '../../install-commit-workflow.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));

test('shipped pre-push template loads the gate in a different home and refuses an unauthorized push', () => {
  const home = mkdtempSync(join(tmpdir(), 'council-template-'));
  try {
    const hooks = join(home, '.claude/scripts/hooks');
    mkdirSync(hooks, { recursive: true });
    cpSync(join(root, 'scripts/hooks'), hooks, { recursive: true });
    const launcher = join(home, 'pre-push');
    copyFileSync(join(root, 'git-template/hooks/pre-push'), launcher);
    const result = spawnSync('sh', [launcher, 'origin', 'unused'], {
      input: 'refs/heads/main aaaa refs/heads/main bbbb\n', encoding: 'utf8',
      env: { ...process.env, HOME: home, COUNCIL_PUSH_AUTHORIZED: '', CLAUDE_PUSH_AUTHORIZED: '' },
      timeout: 10000,
    });
    assert.ifError(result.error);
    assert.equal(result.signal, null);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /explicit owner authorization is required/);
    assert.doesNotMatch(result.stderr, /Cannot find module/);
  } finally { rmSync(home, { recursive: true, force: true }); }
});

test('reinstall refreshes a stale v2 gate, retaining original body, stdin, arguments and backup', () => {
  const home = mkdtempSync(join(tmpdir(), 'council-reinstall-'));
  try {
    const hooks = join(home, 'hooks');
    mkdirSync(hooks);
    const file = join(hooks, 'pre-push');
    const output = join(home, 'observed.json');
    const original = '#!/bin/sh\ncat > "$1"\nprintf "%s" "$0" > "$2"\n';
    writeFileSync(file, original);
    chmodSync(file, 0o755);
    assert.equal(installer.installAt(hooks, '/retired/personal/path.js'), file);
    const backup = readFileSync(`${file}.before-council`);
    const entry = join(home, "gate with ' quote.js");
    writeFileSync(entry, "process.stdin.resume(); process.stdin.on('end', () => process.exit(0));\n");
    assert.equal(installer.installAt(hooks, entry), file);
    const refreshed = readFileSync(file);
    assert.doesNotMatch(refreshed.toString(), /retired\/personal/);
    assert.equal(installer.installAt(hooks, entry), file);
    assert.deepEqual(readFileSync(file), refreshed);
    assert.deepEqual(readFileSync(`${file}.before-council`), backup);
    assert.equal(backup.toString(), original);
    const result = spawnSync(file, [output, `${output}.path`], {
      input: 'one ref update\n\n', encoding: 'utf8', timeout: 10000,
    });
    assert.ifError(result.error);
    assert.equal(result.signal, null);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(output, 'utf8'), 'one ref update\n\n');
    assert.equal(readFileSync(`${output}.path`, 'utf8'), resolve(file));
  } finally { rmSync(home, { recursive: true, force: true }); }
});

test('unknown v2 hook shape is refused without modifying it', () => {
  const home = mkdtempSync(join(tmpdir(), 'council-unknown-hook-'));
  try {
    const file = join(home, 'pre-push');
    const unknown = '#!/bin/sh\n# Council post-commit publication gate v2\necho custom\n';
    writeFileSync(file, unknown);
    assert.throws(() => installer.installAt(home, '/new/gate.js'), /unrecognized Council v2/);
    assert.equal(readFileSync(file, 'utf8'), unknown);
  } finally { rmSync(home, { recursive: true, force: true }); }
});
