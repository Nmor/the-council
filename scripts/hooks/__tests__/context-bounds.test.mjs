// Size budget: 12 KB. Check: wc -c; gate: token-budget.mjs --check.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { HOOKS, advice } from './helpers.mjs';
import lifecycle from '../lib/lifecycle-context.js';

const homes = [];
after(() => { for (const home of homes) rmSync(home, { recursive: true, force: true }); });
function fixture() {
  const home = mkdtempSync(join(tmpdir(), 'context-bounds-'));
  homes.push(home);
  const cwd = join(home, 'project');
  mkdirSync(cwd);
  const sessions = join(home, '.claude', 'sessions');
  mkdirSync(sessions, { recursive: true });
  const old = join(sessions, 'other-project-session.tmp');
  writeFileSync(old, 'OTHER-PROJECT-PRIVATE\n'.repeat(10000));
  return { home, cwd, old };
}
function run(f, hook, input) {
  const result = spawnSync(process.execPath, [join(HOOKS, hook)], {
    cwd: f.cwd, env: { ...process.env, HOME: f.home },
    input: typeof input === 'string' ? input : JSON.stringify({ cwd: f.cwd, session_id: 'my-session', ...input }),
    encoding: 'utf8', timeout: 10000,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  return result;
}
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = join(dir, entry.name);
    return entry.isDirectory() ? files(file) : [file];
  });
}

test('startup and compact never replay a global summary, even a very large one', () => {
  const f = fixture();
  for (const source of ['startup', 'resume', 'clear', 'compact']) {
    const r = run(f, 'session-start.js', { source, hook_event_name: 'SessionStart' });
    assert.ok(Buffer.byteLength(r.stdout) <= 2048);
    assert.doesNotMatch(r.stdout, /OTHER-PROJECT-PRIVATE|Previous session summary/);
    if (source === 'compact') assert.equal(r.stdout, '');
  }
});

test('twenty compactions replace one bounded record and never append to another session', () => {
  const f = fixture();
  const before = readFileSync(f.old);
  for (let i = 0; i < 20; i++) {
    for (const hook of ['pre-compact-council-brief.js', 'pre-compact.js']) {
      const r = run(f, hook, { hook_event_name: 'PreCompact', trigger: 'auto' });
      assert.equal(r.stdout, '');
    }
  }
  assert.deepEqual(readFileSync(f.old), before);
  const briefs = files(join(f.home, '.claude')).filter(file => file.endsWith('-precompact-brief.md'));
  assert.equal(briefs.length, 1);
  assert.ok(Buffer.byteLength(readFileSync(briefs[0])) <= 2048);
});

test('same session ID in two projects and two session IDs in one project stay isolated', () => {
  const f = fixture();
  run(f, 'pre-compact-council-brief.js', {});
  run(f, 'pre-compact-council-brief.js', { session_id: '../different/session' });
  const second = join(f.home, 'second');
  mkdirSync(second);
  run(f, 'pre-compact-council-brief.js', { cwd: second });
  const briefs = files(join(f.home, '.claude')).filter(file => file.endsWith('-precompact-brief.md'));
  assert.equal(briefs.length, 3);
  assert.ok(briefs.every(file => file.startsWith(join(f.home, '.claude', 'projects'))));
});

test('compact recovery uses selected handoff sections without demanding full memory or plan reads', () => {
  const f = fixture();
  const memory = join(f.home, '.claude', 'projects', f.cwd.replace(/[^A-Za-z0-9]/g, '-'), 'memory');
  mkdirSync(memory, { recursive: true });
  const plan = join(f.home, 'plan.md');
  writeFileSync(plan, 'PRIVATE-OLD-HISTORY\n'.repeat(10000));
  writeFileSync(join(memory, 'MEMORY.md'), `Active plan: ${plan}\n${'MEMORY-DETAIL\n'.repeat(10000)}`);
  const r = run(f, 'post-compact-memory-reload.js', { source: 'compact', hook_event_name: 'SessionStart' });
  assert.ok(Buffer.byteLength(r.stdout) <= 2048);
  assert.match(advice(r), /current handoff|relevant sections/);
  assert.doesNotMatch(advice(r), /rather than trusting|re-read it before|PRIVATE-OLD-HISTORY|MEMORY-DETAIL/);
  assert.ok(advice(r).includes(plan));
});

test('PR hook ignores ordinary large Bash output and reports only an actual PR URL', () => {
  const f = fixture();
  const ordinary = run(f, 'pr-created-notice.js', {
    hook_event_name: 'PostToolUse', tool_input: { command: 'cat large.log' },
    tool_response: { stdout: 'PRIVATE-RESULT\n'.repeat(10000) },
  });
  assert.equal(ordinary.stdout, '');
  const pr = run(f, 'pr-created-notice.js', {
    hook_event_name: 'PostToolUse', tool_input: { command: 'gh pr create --body-file /tmp/body' },
    tool_response: { stdout: 'https://github.com/example/repo/pull/123\nPRIVATE-RESULT' },
  });
  assert.match(advice(pr), /https:\/\/github.com\/example\/repo\/pull\/123/);
  assert.doesNotMatch(pr.stdout, /PRIVATE-RESULT/);
  assert.ok(Buffer.byteLength(pr.stdout) < 1024);
});

test('malformed and oversized hook input degrades explicitly without echoing it', () => {
  const f = fixture();
  for (const hook of ['session-start.js', 'pre-compact-council-brief.js', 'post-compact-memory-reload.js', 'pr-created-notice.js']) {
    for (const input of ['not JSON', JSON.stringify({ junk: 'x'.repeat(2 * 1024 * 1024) })]) {
      const r = run(f, hook, input);
      assert.equal(r.stdout, '');
      assert.match(r.stderr, /skipped/);
      assert.ok(Buffer.byteLength(r.stderr) < 512);
    }
  }
});

test('large event metadata is refused and JSON escaping cannot bypass the output bound', () => {
  const f = fixture();
  for (const hook of ['session-start.js', 'pre-compact-council-brief.js', 'post-compact-memory-reload.js', 'pr-created-notice.js']) {
    const r = run(f, hook, { hook_event_name: 'X'.repeat(900000), source: 'compact',
      tool_input: { command: 'gh pr create' }, tool_response: { stdout: 'https://github.com/example/repo/pull/1' } });
    assert.equal(r.stdout, '');
    assert.match(r.stderr, /invalid hook event/);
    assert.ok(Buffer.byteLength(r.stderr) < 512);
  }
  for (const text of ['\u0000'.repeat(5000), '\\"\n\t'.repeat(5000), '🟢'.repeat(5000)]) {
    const result = lifecycle.adviceJSON('SessionStart', text);
    assert.ok(Buffer.byteLength(result) <= 2048);
    const data = JSON.parse(result).hookSpecificOutput;
    assert.equal(data.hookEventName, 'SessionStart');
    assert.doesNotMatch(data.additionalContext, /\uFFFD/);
  }
});

test('project roots that share a native memory key do not share checkpoints', () => {
  const f = fixture();
  for (const name of ['project-a', 'project_a']) {
    const cwd = join(f.home, name);
    mkdirSync(cwd);
    run(f, 'pre-compact-council-brief.js', { cwd });
  }
  const briefs = files(join(f.home, '.claude')).filter(file => file.endsWith('-precompact-brief.md'));
  assert.equal(briefs.length, 2);
});

test('checkpoint writes refuse symlink leaves and parents without changing their targets', { skip: process.platform === 'win32' }, () => {
  const f = fixture();
  run(f, 'pre-compact-council-brief.js', {});
  const brief = files(join(f.home, '.claude')).find(file => file.endsWith('-precompact-brief.md'));
  assert.ok(brief);
  const victim = join(f.home, 'victim');
  writeFileSync(victim, 'keep this');
  rmSync(brief);
  symlinkSync(victim, brief);
  assert.match(run(f, 'pre-compact-council-brief.js', {}).stderr, /unsafe checkpoint/);
  assert.equal(readFileSync(victim, 'utf8'), 'keep this');
  rmSync(join(f.home, '.claude', 'projects'), { recursive: true });
  const outside = join(f.home, 'outside');
  mkdirSync(outside);
  symlinkSync(outside, join(f.home, '.claude', 'projects'));
  assert.match(run(f, 'pre-compact-council-brief.js', {}).stderr, /unsafe checkpoint/);
  assert.deepEqual(readdirSync(outside), []);
});
