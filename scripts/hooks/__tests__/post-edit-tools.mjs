// Size budget: 4 KB. Check: token-budget.mjs --check.
// Local tool fixtures avoid npm downloads and personal caches during hook tests.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const root = process.env.COUNCIL_TEST_NODE_MODULES || '';
const modules = new Map([
  ['prettier', join(root, 'prettier', 'bin', 'prettier.cjs')],
  ['tsc', join(root, 'typescript', 'bin', 'tsc')],
]);
export const prettierAvailable = Boolean(root) && existsSync(modules.get('prettier'));
export const typescriptAvailable = Boolean(root) && existsSync(modules.get('tsc'));

function environment(missing) {
  const directory = join(tmpdir(), missing ? 'missing-edit-tools' : 'local-edit-tools');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const script = `#!${process.execPath}
const {spawnSync} = require('node:child_process');
const tools = new Map(${JSON.stringify([...modules])});
const args = process.argv.slice(2).filter(arg => arg !== '--no-install');
const target = tools.get(args[0]);
if (${missing || !root} || !target) {
  process.stderr.write('npm ERR! fixture tool not found'); process.exitCode = 127;
} else {
  const result = spawnSync(process.execPath, [target, ...args.slice(1)], {encoding:'utf8'});
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) process.stderr.write('fixture subprocess unavailable');
  process.exitCode = result.status ?? 127;
}
`;
  writeFileSync(join(directory, 'npx'), script, { mode: 0o700 });
  return { PATH: directory + (process.platform === 'win32' ? ';' : ':') + (process.env.PATH || ''),
    npm_config_offline: 'true', npm_config_cache: join(tmpdir(), 'npm-fixture-cache') };
}

export const localTools = environment(false);
export const missingTools = environment(true);

if (process.env.COUNCIL_REQUIRE_EDIT_TOOLS === '1' && (!prettierAvailable || !typescriptAvailable)) {
  throw new Error('Required formatter/compiler fixtures unavailable; install pinned test-tools dependencies.');
}
