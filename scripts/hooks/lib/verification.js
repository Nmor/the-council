// Size budget: 8 KB. Check: token-budget.mjs --check.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createHash, randomUUID } = require('node:crypto');
const { commandInvocations } = require('./command-scan.js');
const { markerPath, readPrivate, writePrivate, removePrivate } = require('./private-state.js');
const gs = require('./git-state.js');

const MAX_AGE = 24 * 60 * 60 * 1000;
const CHECK_MODES = new Map([
  ['go', ['test', 'vet', 'build']], ['cargo', ['test', 'build', 'clippy', 'tarpaulin']],
  ['dotnet', ['test', 'build']], ['make', ['test', 'lint', 'build', 'check']],
  ['promtool', ['check', 'test']], ['terraform', ['validate']], ['helm', ['lint']],
  ['golangci-lint', ['run']], ['coverage', ['report']],
]);
const CHECK_TOOLS = new Set(['tsc', 'eslint', 'pytest', 'mypy', 'jest', 'staticcheck',
  'govulncheck', 'gosec', 'markdownlint', 'markdownlint-cli2', 'actionlint', 'kubeconform',
  'shellcheck', 'rspec', 'rubocop']);
const INFO_FLAGS = new Set(['--help', '-h', '--version', '-V', '--collect-only', '--co',
  '--fixtures', '--fixtures-per-test', '--setup-plan', '--markers', '--trace-config',
  '--listTests', '--list', '-list', '-list-checks', '--init', '--env-info',
  '--print-config', '--showConfig', '--listFilesOnly', '--list-optional', '-version',
  '--show-files', '--show-settings', '--watch']);
const GIT = ['/usr/bin/git', '/usr/local/bin/git', '/opt/homebrew/bin/git',
  path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'cmd', 'git.exe')]
  .find(file => fs.existsSync(file));

function checkArgs(invocation) {
  const argv = invocation.argv;
  if (argv[0] === 'npx') return argv.slice(1);
  if (argv[0] === 'bundle' && argv[1] === 'exec') return argv.slice(2);
  if (/^python3?$/.test(argv[0]) && argv[1] === '-m') return argv.slice(2);
  return argv;
}

function checkMode(argv) {
  const [tool, mode] = argv;
  if (tool === 'ruff') return mode === 'check' || (mode === 'format' && argv.includes('--check'));
  if (tool === 'vitest') return !mode || mode.startsWith('-') || mode === 'run';
  if (tool === 'node') return argv.includes('--test');
  if (tool === 'go' && mode === 'tool') return argv[2] === 'cover';
  if (tool === 'nyc' || tool === 'c8') return ['report', 'check-coverage', 'mocha', 'jest',
    'vitest', 'npm', 'pnpm', 'yarn', 'node'].includes(mode);
  if (CHECK_MODES.has(tool)) return CHECK_MODES.get(tool).includes(mode);
  if (['npm', 'pnpm', 'yarn'].includes(tool)) {
    const script = mode === 'run' ? argv[2] : mode;
    return /^(test|lint|build|check|verify|typecheck|type-check|coverage)(:|$)/.test(script || '');
  }
  if (/^python3?$/.test(tool)) return /^validate-manifests(?:-selftest)?\.py$/.test(path.basename(mode || ''));
  return CHECK_TOOLS.has(tool) || /^validate-manifests(?:-selftest)?\.py$/.test(tool);
}

function isCheck(invocation) {
  const argv = checkArgs(invocation);
  if (['go', 'make'].includes(argv[0]) && argv.some(arg =>
    ['-n', '--dry-run', '--just-print', '-t', '--touch'].includes(arg))) return false;
  return !argv.some(arg => INFO_FLAGS.has(arg.split('=')[0])) && checkMode(argv);
}
function terminalSuccess(response) {
  if (!response || typeof response !== 'object' || response.interrupted || response.running ||
      response.session_id || response.sessionId || response.signal || response.is_error || response.isError) return false;
  const codes = [response.exit_code, response.exitCode, response.code].filter(value => value !== undefined);
  return codes.length > 0 && codes.every(value => Number.isInteger(value) && value === 0);
}

function checkInvocation(command) {
  const text = String(command || '').trim();
  if (/[;|`\n!]|\$\(|[<>]/.test(text) || text.replaceAll('&&', '').includes('&')) return false;
  const calls = commandInvocations(text);
  if (calls.some(call => call.changesDirectory)) return false;
  if (calls.length === 2 && calls[0].argv[0] === 'cd' && calls[0].argv.length === 2 && text.includes('&&'))
    return isCheck(calls[1]);
  return calls.length === 1 && isCheck(calls[0]);
}

function checkDirectory(command, cwd) {
  const first = commandInvocations(command)[0];
  return first?.argv[0] === 'cd' ? path.resolve(cwd, first.argv[1]) : cwd;
}

function invalidate(input, kind) {
  if (input.session_id) removePrivate(markerPath(kind, input.session_id));
}

function relevant(command) {
  return commandInvocations(command).some(isCheck);
}

function sourceState(directory) {
  const root = gs.repoRoot(directory);
  if (!root) return null;
  const options = { cwd: root, encoding: 'utf8', timeout: 3000, maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] };
  if (!GIT) throw new Error('git executable unavailable');
  const listed = execFileSync(GIT, ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], options);
  const files = [...new Set(listed.split('\0').filter(file => ['code', 'test'].includes(gs.classify(file))))].sort();
  const hash = createHash('sha256');
  const index = execFileSync(GIT, ['ls-files', '--stage', '-z'], options);
  for (const entry of index.split('\0').filter(Boolean)) {
    const file = entry.slice(entry.indexOf('\t') + 1);
    if (['code', 'test'].includes(gs.classify(file))) hash.update(`index\0${entry}\0`);
  }
  let bytes = 0;
  for (const file of files) {
    const target = path.join(root, file);
    if (!fs.existsSync(target)) { hash.update(`${file}\0deleted\0`); continue; }
    const stat = fs.lstatSync(target);
    if (!stat.isFile()) throw new Error('nonregular verification source');
    bytes += stat.size;
    if (bytes > 16 * 1024 * 1024) throw new Error('verification source exceeds bound');
    hash.update(`${file}\0${stat.size}\0`);
    hash.update(fs.readFileSync(target));
  }
  return { root, digest: hash.digest('hex') };
}

function stagedMatches(directory, files) {
  if (!GIT) throw new Error('git executable unavailable');
  const changed = execFileSync(GIT, ['diff', '--name-only', '-z', '--', ...files],
    { cwd: directory, encoding: 'utf8', timeout: 3000, maxBuffer: 8 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'] });
  return !changed;
}

function record(input, measured) {
  const command = input.tool_input?.command || input.tool_input?.cmd || '';
  if (input.tool_name !== 'Bash' || !relevant(command)) return false;
  const kind = measured === undefined ? 'gate' : 'coverage';
  invalidate(input, kind);
  if (!terminalSuccess(input.tool_response) || !checkInvocation(command) || !input.session_id) return false;
  const proof = { version: 2, at: Date.now(), prompt: input.prompt_id || '',
    attempt: input.tool_use_id || randomUUID(), verified: true,
    command_digest: createHash('sha256').update(command).digest('hex'), exit_code: 0,
    source: sourceState(checkDirectory(command, input.cwd || process.cwd())) };
  writePrivate(markerPath(kind, input.session_id), JSON.stringify({ ...proof, ...(measured === undefined ? {} : { measured }) }));
  return true;
}

function proofFor(kind, input) {
  try {
    const proof = JSON.parse(readPrivate(markerPath(kind, input.session_id)));
    const age = Date.now() - proof.at;
    if (proof.version !== 2 || proof.exit_code !== 0 || typeof proof.at !== 'number' ||
        !Number.isFinite(age) || age < -10000 || age > MAX_AGE || !proof.attempt ||
        proof.verified !== true || !/^[a-f0-9]{64}$/.test(proof.command_digest || '') ||
        (input.prompt_id && proof.prompt !== input.prompt_id)) return null;
    if (kind === 'coverage' && (typeof proof.measured !== 'number' || !Number.isFinite(proof.measured) ||
        proof.measured < 0 || proof.measured > 100)) return null;
    const current = sourceState(input.cwd || process.cwd());
    if (JSON.stringify(current) !== JSON.stringify(proof.source)) return null;
    return proof;
  } catch (error) {
    if (error.code !== 'ENOENT') process.stderr.write(`[verification] unavailable: ${error.code || 'invalid proof'}\n`);
    return null;
  }
}

module.exports = { terminalSuccess, checkInvocation, sourceState, stagedMatches, record, proofFor, invalidate };
