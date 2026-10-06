// Size budget: 12 KB. Check: wc -c; gate: token-budget.mjs --check.
// Evidence paths of docs-sync-gate.js. The gate's promise is the git-state header's:
// "Git sees every change however it was made." These are the three ways a real session's
// work used to become invisible at Stop, each found live on 2026-10-05 ("plan and doc
// update works every time for Codex but not every time for Claude"):
//   1. porcelain mangling — ` M app.py` trimmed then slice(3)'d into `pp.py`, so EDITS to
//      tracked files (the normal mid-task state) carried no evidence; only new files did;
//   2. committed work — a disciplined session commits before Stop, the tree is clean, and
//      `git status` alone forgets the session ever changed code;
//   3. a multi-repo workspace root — cwd has no .git, so the child repo's changes were
//      never consulted at all.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { run, uniq } from './helpers.mjs';
import { git, world, memoryIndex } from './plan-world.mjs';

const gs = createRequire(import.meta.url)('../lib/git-state.js');

const stop = (w, extra = {}) =>
  run('docs-sync-gate.js', { session_id: uniq('sid'), cwd: extra.cwd || w.repo, transcript_path: w.transcript, stop_hook_active: false }, w.env);

describe('docs-sync-gate.js evidence — work is seen however git recorded it', () => {
  test('an edit to an already-tracked file blocks, with its real name', () => {
    const w = world();
    writeFileSync(join(w.repo, 'service.go'), 'package x\n');
    git(w.repo, 'add', '.');
    git(w.repo, 'commit', '-qm', 'track it');
    appendFileSync(join(w.repo, 'service.go'), '// changed\n'); // ` M service.go`
    const r = stop(w);
    assert.equal(r.code, 2, 'a tracked-file edit is the normal mid-task state');
    assert.match(r.stderr, /service\.go/, 'the mangled form (ervice.go/rvice.go) names nothing');
  });

  test('work committed before Stop still demands the plan update', () => {
    const w = world();
    writeFileSync(join(w.repo, 'service.go'), 'package x\n');
    git(w.repo, 'add', '.');
    git(w.repo, 'commit', '-qm', 'finish the task');
    const r = stop(w); // tree is clean; the commit IS this session's work
    assert.equal(r.code, 2, 'committing is how disciplined sessions end — not an escape hatch');
    assert.match(r.stderr, /service\.go/);
  });

  test('a workspace root above several repos sees a child repo\'s change', () => {
    const w = world();
    const ws = join(w.base, 'ws');
    const child = join(ws, 'svc-a');
    mkdirSync(child, { recursive: true });
    git(child, 'init', '-q');
    writeFileSync(join(child, 'main.py'), 'print(1)\n');
    memoryIndex(w.home, ws, `Active plan: ${w.plan}`);
    const r = stop(w, { cwd: ws });
    assert.equal(r.code, 2, 'multi-repo workspaces are how these sessions actually run');
    assert.match(r.stderr, /main\.py/);
  });

  test('a commit from before this session is not this session\'s work', () => {
    const w = world();
    // world() commits its base README after the transcript exists, so stamp the
    // base commit back before the session began.
    git(w.repo, 'commit', '--amend', '-qm', 'base', '--date', new Date(Date.now() - 7200000).toISOString());
    assert.equal(stop(w).code, 0, 'pre-session commits must not block every later turn');
  });

  test('lib: dirtyFiles returns the exact path of a modified tracked file', () => {
    const w = world();
    writeFileSync(join(w.repo, 'app.py'), 'x = 1\n');
    git(w.repo, 'add', '.');
    git(w.repo, 'commit', '-qm', 'track');
    appendFileSync(join(w.repo, 'app.py'), 'y = 2\n');
    assert.deepEqual(gs.dirtyFiles(w.repo).sort(), ['app.py']);
  });

  test('lib: dirtyFiles survives a rename and a path with spaces', () => {
    const w = world();
    writeFileSync(join(w.repo, 'a dir'), ''); // placeholder keeps mkdir out of git
    mkdirSync(join(w.repo, 'src'), { recursive: true });
    writeFileSync(join(w.repo, 'src', 'old name.py'), 'x\n');
    git(w.repo, 'add', '.');
    git(w.repo, 'commit', '-qm', 'track');
    git(w.repo, 'mv', 'src/old name.py', 'src/new name.py');
    const files = gs.dirtyFiles(w.repo);
    assert.ok(files.includes('src/new name.py'), JSON.stringify(files));
  });
});
