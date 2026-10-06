// Size budget: 15 KB. Check: token-budget.mjs --check.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { run, uniq, markerExists, marker, verificationProof, HOOKS } from './helpers.mjs';
import { world, edit, git } from './plan-world.mjs';

const payload = (sid, response, command = 'go test ./...') => ({
  session_id: sid, prompt_id: 'turn', tool_name: 'Bash',
  tool_input: { command }, tool_response: response,
});

for (const response of [{ exit_code: 1 }, {}, { exit_code: 0, session_id: 123 },
  { exit_code: 0, interrupted: true }, { exit_code: 0, running: true }]) {
  test(`unknown/failed/running verification cannot create proof: ${JSON.stringify(response)}`, () => {
    const sid = uniq('proof');
    assert.equal(run('gate-marker.js', payload(sid, response)).code, 0);
    assert.equal(markerExists(`claude-council-gate-${sid}`), false);
  });
}

for (const command of ['false && go test ./...; true', 'go test ./... || true',
  'echo "go test ./..."', 'go test ./...; true', 'go test ./... &', '! go test ./...',
  'pytest --version', 'eslint --version', 'go testfoo', 'npm run deploy', 'gofmt .',
  'ruff format .', 'ruff check --show-files', 'pytest --fixtures', 'pytest --setup-plan',
  'vitest list', 'npx tsc-alias', 'eslint-config .', 'go test -list .', 'tsc --init',
  'pytest --markers', 'make -n test', 'go build -n ./...', 'tsc --listFilesOnly',
  'eslint --env-info', 'actionlint -version', 'staticcheck -version', 'govulncheck -version',
  'shellcheck --list-optional', 'nyc instrument src out', 'nyc merge source destination']) {
  test(`shell masking or literal text cannot create proof: ${command}`, () => {
    const sid = uniq('proof');
    assert.equal(run('gate-marker.js', payload(sid, { exit_code: 0 }, command)).code, 0);
    assert.equal(markerExists(`claude-council-gate-${sid}`), false);
  });
}

for (const command of ['env -C /other node --test', 'env -C/other node --test',
  'env --chdir /other node --test', 'env --chdir=/other node --test',
  'sudo -D /other node --test', 'sudo -D/other node --test',
  'sudo --chdir /other node --test', 'sudo --chdir=/other node --test',
  'env command sudo -nD/other node --test',
  'env -S "env -C /other node --test"']) {
  test(`directory-changing wrappers cannot create proof: ${command}`, () => {
    const sid = uniq('wrapper-proof');
    assert.equal(run('gate-marker.js', payload(sid, { exit_code: 0 }, command)).code, 0);
    assert.equal(markerExists(`claude-council-gate-${sid}`), false);
  });
}

test('real tests run in another repository cannot verify the original repository', t => {
  const original = world();
  const other = world();
  t.after(() => {
    rmSync(original.base, { recursive: true, force: true });
    rmSync(other.base, { recursive: true, force: true });
  });
  const sid = uniq('real-wrapper-proof');
  const file = join(other.repo, 'cwd.test.cjs');
  writeFileSync(file, `require('node:assert/strict').equal(process.cwd(), ${JSON.stringify(other.repo)});\n`);
  const response = spawnSync('/usr/bin/env', ['-C', other.repo, process.execPath, '--test', file],
    { cwd: original.repo, encoding: 'utf8', timeout: 15000 });
  assert.ifError(response.error);
  assert.equal(response.signal, null);
  assert.equal(response.status, 0, response.stderr);
  const input = { ...payload(sid, { exit_code: response.status },
    `env -C '${other.repo}' '${process.execPath}' --test '${file}'`), cwd: original.repo };
  const positive = run('gate-marker.js', { ...input, tool_input: { command: 'env node --test' } });
  assert.equal(positive.code, 0);
  const proofFile = marker(`claude-council-gate-${sid}`);
  assert.equal(JSON.parse(readFileSync(proofFile, 'utf8')).source.root, original.repo);
  const rejected = run('gate-marker.js', input);
  assert.equal(rejected.code, 0);
  assert.equal(markerExists(`claude-council-gate-${sid}`), false, 'invalidate the older proof');
});

for (const command of ['ruff check .', 'ruff format --check .', 'python3 -m pytest -q',
  'vitest run', 'npx tsc --noEmit', 'node --test']) {
  test(`exact verification command produces proof: ${command}`, () => {
    const sid = uniq('check');
    assert.equal(run('gate-marker.js', payload(sid, { exit_code: 0 }, command)).code, 0);
    assert.equal(markerExists(`claude-council-gate-${sid}`), true);
  });
}

test('verification records omit raw credentials and failed reruns invalidate proof', () => {
  const sid = uniq('secret-proof');
  const secret = 'fake-verification-token-123456';
  const command = `API_TOKEN=${secret} go test ./...`;
  assert.equal(run('gate-marker.js', payload(sid, { exit_code: 0 }, command)).code, 0);
  const file = marker(`claude-council-gate-${sid}`);
  assert.equal(readFileSync(file, 'utf8').includes(secret), false);
  assert.equal(run('gate-marker.js', payload(sid, { exit_code: 1 }, command)).code, 0);
  assert.equal(markerExists(`claude-council-gate-${sid}`), false);
});

test('source changes and mismatched staged contents cannot reuse verification', () => {
  const w = world();
  const sid = uniq('source-proof');
  edit(w, 'main.go', 'package old\n');
  git(w.repo, 'add', 'main.go');
  edit(w, 'main.go', 'package current\n');
  verificationProof(sid, 'turn', w.repo, w.env);
  verificationProof(sid, 'turn', w.repo, w.env, true);
  const input = { session_id: sid, prompt_id: 'turn', cwd: w.repo, tool_name: 'Bash',
    tool_input: { command: 'git commit -m "test\nDocs: no reader-facing change"' } };
  const mismatch = run('commit-gate.js', input, w.env);
  assert.equal(mismatch.code, 2);
  assert.match(mismatch.stderr, /staged source differs/);
  const cancelledAll = run('commit-gate.js', { ...input, tool_input:
    { command: 'git commit -a --no-all -m "test\nDocs: no reader-facing change"' } }, w.env);
  assert.equal(cancelledAll.code, 2);
  assert.match(cancelledAll.stderr, /staged source differs/);
  edit(w, 'main.go', 'package changed\n');
  const changed = run('commit-gate.js', input, w.env);
  assert.equal(changed.code, 2);
  assert.match(changed.stderr, /no verification gate/);
});

test('redaction covers CLI values, escaped quotes and non-HTTP credential URLs', () => {
  const home = mkdtempSync(join(tmpdir(), 'redact-home-'));
  const secret = 'fake-redaction-secret-987654';
  const result = run('tool-failure-recorder.js', { session_id: 'redact',
    error: `--password ${secret} postgres://user:${secret}@db/app password="part\\"${secret}"\n` +
      `API_TOKEN=first\\ ${secret} --password first\\ ${secret} password="first\n${secret}"` },
  { HOME: home, USERPROFILE: home });
  assert.equal(result.code, 0);
  assert.equal(result.stderr, '');
  const file = join(home, '.claude', 'audits', 'tool-failures.jsonl');
  assert.equal(readFileSync(file, 'utf8').includes(secret), false);
});

test('successful coverage requires a genuine nonempty percentage', () => {
  for (const response of [{ exit_code: 1, stdout: 'coverage: 90% of statements' },
    { exit_code: 0, stdout: '' }, { exit_code: 0, stdout: 'coverage: 190% of statements' }]) {
    const sid = uniq('cov');
    assert.equal(run('test-coverage-marker.js', payload(sid, response, 'go test ./... -cover')).code, 0);
    assert.equal(markerExists(`claude-council-coverage-${sid}`), false);
  }
  const sid = uniq('cov');
  assert.equal(run('test-coverage-marker.js', payload(sid,
    { exit_code: 0, stdout: 'coverage: 90% of statements' }, 'go test ./... -cover')).code, 0);
  assert.equal(markerExists(`claude-council-coverage-${sid}`), true);
});

test('marker writes cannot follow a precreated symlink', () => {
  const sid = uniq('sym');
  const base = mkdtempSync(join(tmpdir(), 'marker-victim-'));
  const victim = join(base, 'victim');
  writeFileSync(victim, 'untouched');
  const record = marker(`claude-council-gate-${sid}`);
  mkdirSync(join(record, '..'), { recursive: true });
  symlinkSync(victim, record);
  const result = run('gate-marker.js', payload(sid, { exit_code: 0 }));
  assert.equal(result.code, 0);
  assert.equal(readFileSync(victim, 'utf8'), 'untouched');
});

test('audit records redact before truncation and are private', () => {
  const home = mkdtempSync(join(tmpdir(), 'audit-home-'));
  const secret = 'example-credential-value-123456789';
  for (const hook of ['permission-denied-audit.js', 'tool-failure-recorder.js']) {
    const result = run(hook, { session_id: 'session', reason: `AWS_SECRET_ACCESS_KEY=${secret}`,
      error: `Authorization: Bearer ${secret}` }, { HOME: home, USERPROFILE: home });
    assert.equal(result.code, 0);
  }
  const directory = join(home, '.claude', 'audits');
  for (const name of readdirSync(directory)) {
    const file = join(directory, name);
    assert.equal(readFileSync(file, 'utf8').includes(secret), false);
    if (process.platform !== 'win32') assert.equal(statSync(file).mode & 0o777, 0o600);
  }
  if (process.platform !== 'win32') assert.equal(statSync(directory).mode & 0o777, 0o700);
});

test('session summaries redact multiline credentials and use private files', () => {
  const home = mkdtempSync(join(tmpdir(), 'summary-home-'));
  const transcript = join(home, 'transcript.jsonl');
  const secret = 'example-session-value-123456789';
  writeFileSync(transcript, JSON.stringify({ role: 'user', content:
    `Do the work\npassword=${secret}\n-----BEGIN PRIVATE KEY-----\n${secret}\n-----END PRIVATE KEY-----` }) + '\n');
  const result = run('session-end.js', { transcript_path: transcript },
    { HOME: home, USERPROFILE: home, CLAUDE_SESSION_ID: 'test-session' });
  assert.equal(result.code, 0);
  const sessions = join(home, '.claude', 'sessions');
  const files = readdirSync(sessions);
  assert.equal(files.length, 1);
  const file = join(sessions, files[0]);
  assert.equal(readFileSync(file, 'utf8').includes(secret), false);
  if (process.platform !== 'win32') assert.equal(statSync(file).mode & 0o777, 0o600);
});

function auditChild(home, id) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(HOOKS, 'tool-failure-recorder.js')], {
      env: { ...process.env, HOME: home, USERPROFILE: home }, stdio: ['pipe', 'pipe', 'pipe'],
    });
    const timer = setTimeout(() => {
      if (!child.kill('SIGTERM')) reject(new Error('Audit child termination failed'));
    }, 5000);
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      if (code !== 0 || signal || output) reject(new Error(`Audit child failed: ${code}/${signal}: ${output}`));
      else resolve(code);
    });
    child.stdin.on('error', reject);
    child.stdin.end(JSON.stringify({ session_id: id, error: 'fixture failure' }));
  });
}

test('concurrent audits retain every event and expire old records', async () => {
  const home = mkdtempSync(join(tmpdir(), 'concurrent-audit-'));
  const directory = join(home, '.claude', 'audits');
  mkdirSync(directory, { recursive: true });
  const file = join(directory, 'tool-failures.jsonl');
  writeFileSync(file, JSON.stringify({ ts: '2000-01-01T00:00:00Z', error: 'expired' }) + '\n');
  const ids = Array.from({ length: 8 }, (_, index) => `concurrent-${index}`);
  const results = await Promise.all(ids.map(id => auditChild(home, id)));
  assert.deepEqual(results, ids.map(() => 0));
  const records = readFileSync(file, 'utf8').trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(records.map(row => row.session_id).sort(), ids.sort());
  assert.equal(readFileSync(file, 'utf8').includes('expired'), false);
  if (process.platform !== 'win32') assert.equal(statSync(file).mode & 0o777, 0o600);
});

test('test harness preserves inherited home and temp sentinels on pass, failure and interruption', () => {
  const base = mkdtempSync(join(tmpdir(), 'outer-state-'));
  const home = join(base, 'home');
  const temporary = join(base, 'tmp');
  mkdirSync(home);
  mkdirSync(temporary);
  writeFileSync(join(home, 'sentinel'), 'home unchanged');
  writeFileSync(join(temporary, 'sentinel'), 'temp unchanged');
  const helperUrl = pathToFileURL(join(HOOKS, '__tests__', 'helpers.mjs')).href;
  for (const mode of ['pass', 'fail', 'interrupt']) {
    const code = `const h = await import(${JSON.stringify(helperUrl)});
      const r = h.run('tool-failure-recorder.js', {error:'isolated fixture'});
      if (r.code !== 0 || r.stderr) throw new Error('fixture failed');
      process.stdout.write(JSON.stringify({home:process.env.HOME,tmp:process.env.TMPDIR}));
      if (${JSON.stringify(mode)} === 'fail') process.exitCode = 1;
      if (${JSON.stringify(mode)} === 'interrupt') setInterval(() => {}, 1000);`;
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
      env: { ...process.env, HOME: home, USERPROFILE: home, TMPDIR: temporary, TMP: temporary, TEMP: temporary },
      encoding: 'utf8', timeout: 2000,
    });
    if (mode === 'interrupt') {
      assert.equal(child.error?.code, 'ETIMEDOUT');
      assert.equal(child.status, null);
      assert.equal(child.signal, 'SIGTERM');
    } else {
      assert.equal(child.error, undefined);
      assert.equal(child.signal, null);
      assert.equal(child.status, mode === 'pass' ? 0 : 1);
    }
    assert.equal(child.stderr, '');
    const state = JSON.parse(child.stdout);
    assert.notEqual(state.home, home);
    assert.notEqual(state.tmp, temporary);
    assert.equal(readFileSync(join(home, 'sentinel'), 'utf8'), 'home unchanged');
    assert.equal(readFileSync(join(temporary, 'sentinel'), 'utf8'), 'temp unchanged');
    assert.deepEqual(readdirSync(home), ['sentinel']);
    rmSync(join(state.tmp, '..'), { recursive: true, force: true });
    assert.deepEqual(readdirSync(temporary), ['sentinel']);
  }
});
