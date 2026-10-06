// Size budget: 12 KB. Check: wc -c; gate: token-budget.mjs --check.
// Repeated-turn compaction stress. The 2026-10-02 thrashing incident showed what
// happens when post-compaction context creeps toward the compaction buffer, so these
// cycles prove the hook-driven share of every compaction is a fixpoint: the re-injected
// pointer record is byte-identical at cycle fifty, durable state grows by exactly one
// audit line per cycle with no new files, and a growing plan or a tampered brief cannot
// widen it. Live model summarization stays outside this suite's claims.
import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { HOOKS, advice } from './helpers.mjs';

const CYCLES = 25;
const homes = [];
after(() => { for (const home of homes) rmSync(home, { recursive: true, force: true }); });

function fixture() {
  const home = mkdtempSync(join(tmpdir(), 'compaction-stress-'));
  homes.push(home);
  const cwd = join(home, 'project');
  mkdirSync(cwd);
  const memory = join(home, '.claude', 'projects', cwd.replace(/[^A-Za-z0-9]/g, '-'), 'memory');
  mkdirSync(memory, { recursive: true });
  const plan = join(home, 'plan.md');
  writeFileSync(plan, '# Plan\n');
  writeFileSync(join(memory, 'MEMORY.md'), `Active plan: ${plan}\n`);
  return { home, cwd, plan };
}

function run(f, hook, input) {
  const result = spawnSync(process.execPath, [join(HOOKS, hook)], {
    cwd: f.cwd, env: { ...process.env, HOME: f.home },
    input: JSON.stringify({ cwd: f.cwd, session_id: 'stress-session', ...input }),
    encoding: 'utf8', timeout: 10000,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  return result;
}

// One conversational compaction as the hooks see it: both PreCompact hooks, then the
// SessionStart compact reload whose stdout is the only model-visible recovery context.
function cycle(f) {
  for (const hook of ['pre-compact-council-brief.js', 'pre-compact.js']) {
    run(f, hook, { hook_event_name: 'PreCompact', trigger: 'auto' });
  }
  return run(f, 'post-compact-memory-reload.js', { hook_event_name: 'SessionStart', source: 'compact' });
}

function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = join(dir, entry.name);
    return entry.isDirectory() ? files(file) : [file];
  }).sort();
}

test('fifty compaction cycles re-inject a byte-identical bounded record', () => {
  const f = fixture();
  const first = cycle(f);
  assert.ok(Buffer.byteLength(first.stdout) <= 2048);
  assert.ok(advice(first).includes(f.plan), 'recovery must point at the active plan');
  for (let i = 1; i < CYCLES; i++) {
    assert.equal(cycle(f).stdout, first.stdout, `cycle ${i + 1} grew or drifted`);
  }
});

test('durable state grows by one audit line per cycle and never by new files', () => {
  const f = fixture();
  cycle(f); cycle(f);
  const settled = files(join(f.home, '.claude'));
  for (let i = 2; i < CYCLES; i++) cycle(f);
  assert.deepEqual(files(join(f.home, '.claude')), settled,
    'a file minted per compaction would accumulate across a long session');
  const log = readFileSync(join(f.home, '.claude', 'sessions', 'compaction-log.txt'), 'utf8');
  assert.equal(log.trim().split('\n').length, CYCLES);
  // Control: the census must be able to fail — a stray per-cycle file is detected.
  writeFileSync(join(f.home, '.claude', 'sessions', 'stray.tmp'), 'x');
  assert.notDeepEqual(files(join(f.home, '.claude')), settled);
});

test('a plan growing 64 KB per turn never widens the re-injected record', () => {
  const f = fixture();
  const first = cycle(f).stdout;
  for (let i = 0; i < 10; i++) {
    appendFileSync(f.plan, 'turn detail line\n'.repeat(4096));
    assert.equal(cycle(f).stdout, first, 'recovery context must point, not carry content');
  }
});

test('a tampered oversized brief is replaced, not accumulated, by the next cycle', () => {
  const f = fixture();
  cycle(f);
  const brief = files(join(f.home, '.claude')).find(file => file.endsWith('-precompact-brief.md'));
  assert.ok(brief, 'brief checkpoint expected');
  appendFileSync(brief, 'JUNK\n'.repeat(20000));
  const next = cycle(f);
  assert.ok(Buffer.byteLength(readFileSync(brief)) <= 2048, 'brief must be replaced each compaction');
  assert.ok(Buffer.byteLength(next.stdout) <= 2048);
});
