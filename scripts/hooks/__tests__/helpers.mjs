// Size budget: 8 KB. Check: wc -c; gate: token-budget.mjs --check.
// Shared harness for hook tests.
//
// A hook is a process contract: JSON on stdin, an exit code that may block, and text on
// stderr that the model sees only when it blocks. So the tests drive the real binary rather
// than importing internals — importing would test a different thing from what Claude Code
// runs, and the bugs found on 2026-09-21 were all in that gap.
import { spawnSync } from 'node:child_process';
import { existsSync, rmSync, readFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import state from '../lib/private-state.js';

export const HOOKS = join(dirname(fileURLToPath(import.meta.url)), '..');

const sandbox = mkdtempSync(join(tmpdir(), 'council-hook-tests-'));
const testHome = join(sandbox, 'home');
const testTemp = join(sandbox, 'tmp');
mkdirSync(testHome, { mode: 0o700 });
mkdirSync(testTemp, { mode: 0o700 });
Object.assign(process.env, { HOME: testHome, USERPROFILE: testHome,
  TMPDIR: testTemp, TMP: testTemp, TEMP: testTemp });
process.once('exit', () => rmSync(sandbox, { recursive: true, force: true }));

// run a hook exactly as the harness does. Payload is an object; it is sent as JSON on stdin.
// NOTE: never build this string with shell `echo` — zsh expands \n inside it and mangles the
// JSON, which silently sends the hook down its parse-failure path and makes every test pass.
export function run(hook, payload, env = {}) {
  const r = spawnSync(process.execPath, [join(HOOKS, hook)], {
    input: typeof payload === 'string' ? payload : JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, ...env },
    timeout: 15000,
  });
  if (r.error) throw new Error(`Hook process failed: ${hook}`, { cause: r.error });
  if (r.signal) throw new Error(`Hook process terminated: ${hook} (${r.signal})`);
  return { code: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

export function json(stdout) {
  try {
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

let n = 0;
export const uniq = (p = 'id') => `${p}-${process.pid}-${Date.now()}-${n++}`;

export const marker = (name) => {
  const match = /^claude-council-(gate|coverage|intake-nudged|intake|research|payload|parity|lastedit|srcedits|covnudge|claimwall|format-missing|format-failed)-(.+)$/.exec(name)
    || /^claude-(supersede-proof)-(.+)$/.exec(name)
    || /^claude-docs-sync-(code|docs|plan|memory)-(.+)$/.exec(name)?.map((value, index) => index === 1 ? `docs-sync-${value}` : value);
  if (!match) return join(tmpdir(), name);
  const file = state.markerPath(match[1], match[2]);
  state.privateDirectory(dirname(file));
  return file;
};
export const markerExists = (name) => existsSync(marker(name));
export const markerText = (name) => {
  try {
    return readFileSync(marker(name), 'utf8');
  } catch {
    return '';
  }
};
export const cleanup = (...names) => {
  for (const nm of names) rmSync(marker(nm), { force: true });
};

export function verificationProof(sid, prompt = '', cwd, env = {}, coverage = false) {
  const result = run(coverage ? 'test-coverage-marker.js' : 'gate-marker.js', {
    session_id: sid, prompt_id: prompt, cwd, tool_name: 'Bash',
    tool_input: { command: coverage ? 'go test ./... -cover' : 'go test ./...' },
    tool_response: { exit_code: 0, stdout: coverage ? 'coverage: 90% of statements' : 'ok' },
  }, env);
  if (result.code !== 0 || result.stderr) throw new Error(`Proof fixture failed: ${result.stderr}`);
  return result;
}

// What a NON-blocking hook told Claude. Stderr on exit 0 goes to the debug log only and is
// never shown (hooks reference, read 2026-09-21), so advice must arrive as
// hookSpecificOutput.additionalContext, or as a systemMessage for the user where the event
// would otherwise reopen the turn. Tests read this, so advice regressing to stderr fails them.
export function advice(r) {
  const o = json((r.stdout || '').trim());
  return (o && ((o.hookSpecificOutput && o.hookSpecificOutput.additionalContext) || o.systemMessage)) || '';
}

// Everything a hook emitted, on any channel: a hook that must stay SILENT says nothing on
// either, so a silence test cannot pass just because the text moved to stdout.
export const said = (r) => `${r.stderr || ''}${advice(r)}`;
