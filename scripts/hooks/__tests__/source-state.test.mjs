// Size budget: 4 KB. Check: wc -c; gate: token-budget.mjs --check.
// lib/source-state.js — the tree a verification proof is bound to. It read every source file
// and refused a repository over 16 MB, so in a large repository no check could be proven and
// every commit was refused as unverified. These pin that size no longer matters, and that the
// digest still follows every content change, and only content.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, rmSync, utimesSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HOOKS, uniq, cleanup, verificationProof } from './helpers.mjs';

const req = createRequire(import.meta.url);
const { sourceState } = req(join(HOOKS, 'lib', 'source-state.js'));
const { proofFor } = req(join(HOOKS, 'lib', 'verification.js'));
const OVER_BOUND = 17 * 1024 * 1024;

describe('source-state.js — the tree a proof is bound to', () => {
  let repo;
  const git = (...args) => assert.equal(
    spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t.invalid', ...args], { cwd: repo }).status, 0);
  const digest = () => sourceState(repo).digest;
  const put = (file, text) => writeFileSync(join(repo, file), text);
  before(() => {
    repo = mkdtempSync(join(tmpdir(), 'source-state-'));
    git('init', '-q');
    put('big.js', `// ${'x'.repeat(OVER_BOUND)}\n`);
    put('a.js', 'export const a = 1;\n');
    put('README.md', '# r\n');
    git('add', '.');
    git('commit', '-qm', 'base');
  });
  after(() => rmSync(repo, { recursive: true, force: true }));

  test('a repository with more than 16 MB of source is fingerprinted, and a check in it is proven', () => {
    assert.match(digest(), /^[a-f0-9]{64}$/);
    const sid = uniq('sid');
    verificationProof(sid, 't1', repo);
    assert.ok(proofFor('gate', { session_id: sid, cwd: repo }), 'the passing check left no proof');
    cleanup(`claude-council-gate-${sid}`);
  });

  test('the digest follows every content change, and only content', () => {
    const seen = [digest()];
    const changed = () => seen.push(digest());
    utimesSync(join(repo, 'a.js'), new Date(2030, 0, 1), new Date(2030, 0, 1));
    assert.equal(digest(), seen[0], 'a touch is not a change');
    put('README.md', '# docs only\n');
    assert.equal(digest(), seen[0], 'docs are not source');
    put('a.js', 'export const a = 2;\n'); changed(); // edited
    git('add', 'a.js'); changed(); // staged
    put('a.js', 'export const a = 1;\n'); changed(); // staged, then edited back
    put('b.js', 'export const b = 1;\n'); changed(); // untracked
    unlinkSync(join(repo, 'big.js')); changed(); // deleted
    assert.equal(new Set(seen).size, seen.length, 'a change left the digest where it was');
  });

  test('untracked source is still bounded', () => {
    put('huge.js', 'x'.repeat(OVER_BOUND));
    assert.throws(digest, /untracked verification source exceeds bound/);
    rmSync(join(repo, 'huge.js'));
  });

  test('outside a repository there is no state', () => {
    assert.equal(sourceState(tmpdir()), null);
  });
});
