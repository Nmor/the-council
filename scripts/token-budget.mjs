#!/usr/bin/env node
// Estimate Council instruction size, not billed tokens or actual per-turn usage.
//
//   node ~/.claude/scripts/token-budget.mjs          # summary
//   node ~/.claude/scripts/token-budget.mjs --full   # every over-cap skill
//   node ~/.claude/scripts/token-budget.mjs --json   # machine-readable
//   node ~/.claude/scripts/token-budget.mjs --check  # GATE: exit 1 if any file is
//                                                    # over its budget or eager cap
//   node scripts/token-budget.mjs --root . --json    # measure this checkout
//
// Static bytes/4 estimates support context budgeting; they do not measure tokenizer
// usage, referenced content loaded later, conversation, caching or billed tokens.
// Size budget: 12 KB. Check: wc -c; gate: token-budget.mjs --check.
import { readdirSync, statSync, existsSync, readFileSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
// Policy keys and reports are posix-form; Windows native separators must not
// defeat instruction-budgets.json matching (found on the windows CI runner).
const rel = (root, file) => relative(root, file).replaceAll('\\', '/');
import { homedir } from 'node:os';
import { parseArgs } from 'node:util';
import { ruleIsScoped } from './lib/rule-scope.mjs';

let options;
try {
  options = parseArgs({ options: {
    root: { type: 'string' }, 'selected-skill': { type: 'string', multiple: true }, 'max-floor-bytes': { type: 'string' },
    full: { type: 'boolean' }, json: { type: 'boolean' }, check: { type: 'boolean' },
  } }).values;
} catch (error) {
  process.stderr.write(`token-budget: ${error.message}\n`);
  process.exit(2);
}
const ROOT = options.root ? resolve(options.root) : join(homedir(), '.claude');
const MAX_FLOOR_BYTES = Number(options['max-floor-bytes'] ?? 24_576);
if (!Number.isSafeInteger(MAX_FLOOR_BYTES) || MAX_FLOOR_BYTES <= 0 ||
    (options.root && (!existsSync(ROOT) || !statSync(ROOT).isDirectory()))) {
  process.stderr.write('token-budget: --root must be a directory; --max-floor-bytes must be a positive integer\n');
  process.exit(2);
}
const SKILL_CAP = 25_000; // bytes; CLAUDE.md's progressive-disclosure threshold
// Independently managed libraries are reported rather than rewritten or budgeted.
const VENDORED = new Set(['synced', 'graphify']);
let thirdParty = new Set();
const tok = (bytes) => Math.round(bytes / 4);
const fmt = (n) => n.toLocaleString('en-US');

function bytesOf(files) {
  return files.reduce((sum, f) => {
    try {
      return sum + statSync(f).size;
    } catch {
      return sum;
    }
  }, 0);
}

function mdIn(dir, depth = Infinity) {
  const out = [];
  const walk = (d, left) => {
    if (left < 0) return;
    let entries = [];
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p, left - 1);
      else if (e.name.endsWith('.md')) out.push(p);
    }
  };
  walk(dir, depth);
  return out;
}

const ruleFiles = mdIn(join(ROOT, 'rules'));
const scopedFiles = ruleFiles.filter(file => ruleIsScoped(readFileSync(file, 'utf8')));
const scopedSet = new Set(scopedFiles);
const floorFiles = [
  ...ruleFiles.filter((file) => !scopedSet.has(file)),
  join(ROOT, 'CLAUDE.md'),
].filter((f) => existsSync(f));
const floorBytes = bytesOf(floorFiles);

// Per-rule breakdown, largest first.
const floorRules = floorFiles
  .map((f) => ({ name: rel(ROOT, f), bytes: statSync(f).size }))
  .sort((a, b) => b.bytes - a.bytes);

// Skills: lazy, but a gated skill is deferred rather than free. When selected it is added to
// the Floor, so its size is what one matching file actually costs.
const skillsDir = join(ROOT, 'skills');
const skills = [];
try {
  for (const d of readdirSync(skillsDir, { withFileTypes: true })) {
    if (!d.isDirectory() || VENDORED.has(d.name)) continue;
    const main = join(skillsDir, d.name, 'SKILL.md');
    if (!existsSync(main)) continue;
    const bytes = statSync(main).size;
    const refs = mdIn(join(skillsDir, d.name), 2).filter((f) => !f.endsWith('SKILL.md')).length;
    skills.push({ name: d.name, bytes, refs });
  }
} catch (err) {
  // An install with no skills directory is valid, so this is not fatal — but say so rather
  // than reporting "0 skills over cap", which reads as a clean bill of health.
  process.stderr.write(`token-budget: skills not readable (${err.code || 'error'})\n`);
}
skills.sort((a, b) => b.bytes - a.bytes);
const over = skills.filter((s) => s.bytes > SKILL_CAP);

const selectedNames = [...new Set(options['selected-skill'] || [])];
const selected = selectedNames.map((name) => skills.find((skill) => skill.name === name));
if (selected.some((skill) => !skill)) {
  process.stderr.write('token-budget: every --selected-skill must name a discoverable source skill\n');
  process.exit(2);
}
const selectedBytes = floorBytes + selected.reduce((sum, skill) => sum + skill.bytes, 0);

const report = {
  root: ROOT,
  estimate: { method: 'bytes / 4, rounded', billedTokens: false,
    note: 'Static instruction-size estimate; excludes scoped matches, referenced content, conversation, tools and caching.' },
  floor: { bytes: floorBytes, tokens: tok(floorBytes), files: floorFiles.length },
  floorLimitBytes: MAX_FLOOR_BYTES,
  scopedRules: { bytes: bytesOf(scopedFiles), files: scopedFiles.length },
  selected: { names: selectedNames, bytes: selectedBytes, tokens: tok(selectedBytes), referencesIncluded: false },
  worstCase: {
    skill: skills[0]?.name ?? null,
    tokens: tok(floorBytes + (skills[0]?.bytes ?? 0)),
  },
  skills: {
    total: skills.length,
    overCap: over.length,
    overCapTokens: tok(over.reduce((s, x) => s + x.bytes, 0)),
    withProgressiveDisclosure: over.filter((s) => s.refs > 0).length,
  },
};

// A missing declaration is unmeasured, never evidence of compliance.
const SIZE_BUDGET = /^[\s>*#/-]*Size budget:\s*([\d.]+)\s*(KB|B)\b/i;

function declaredBudget(file) {
  let head;
  try {
    // The window starts AFTER any YAML front matter. A skill with 32 `paths:` globs put its
    // title, and so its budget, on line 45 — past a window counted from the top of the file.
    head = readFileSync(file, 'utf8').replace(/^---\n[\s\S]*?\n---\n/, '').split('\n', 40);
  } catch {
    return 0;
  }
  for (const line of head) {
    const m = SIZE_BUDGET.exec(line);
    if (m) return Math.round(parseFloat(m[1]) * (m[2].toUpperCase() === 'KB' ? 1024 : 1));
  }
  return 0;
}

// Source budgets cover eager instructions and deferred executable/reference content.
function budgetCandidates() {
  const out = [];
  const exts = ['.md', '.js', '.mjs', '.sh', '.py', '.ps1', '.json', '.toml', '.in'];
  const walk = (dir, left) => {
    if (left < 0) return;
    let entries = [];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name.startsWith('.') || VENDORED.has(e.name)) continue;
      const f = join(dir, e.name);
      if (e.isDirectory()) {
        if (!thirdParty.has(f)) walk(f, left - 1);
        continue;
      }
      else if (exts.some((x) => e.name.endsWith(x))) out.push(f);
    }
  };
  // A live home's plugins/ holds installed marketplaces, caches and runtime
  // registries — content the Council neither authors nor budgets. Plugins-root
  // CONFIGURATION files stay candidates (resolved by reviewed policy entries,
  // like settings.json).
  thirdParty = new Set(['marketplaces', 'cache', 'data'].map((d) => join(ROOT, 'plugins', d)));
  for (const d of ['rules', 'rules-library', 'skills', 'scripts', 'agents', 'hooks', 'codex', 'bootstrap', 'plugins']) walk(join(ROOT, d), Infinity);
  for (const name of ['CLAUDE.md', 'settings.json', '.claude-plugin/plugin.json', '.claude-plugin/marketplace.json']) {
    const top = join(ROOT, name);
    if (existsSync(top)) out.push(top);
  }
  return out;
}

if (process.argv.includes('--check')) {
  const over = [];
  const missing = [];
  const policy = join(ROOT, 'scripts/instruction-budgets.json');
  const budgets = new Map(Object.entries(existsSync(policy) ? JSON.parse(readFileSync(policy, 'utf8')) : {}));
  let declared = 0;
  const candidates = budgetCandidates();
  for (const f of candidates) {
    const name = rel(ROOT, f);
    const configured = budgets.get(name);
    const budget = declaredBudget(f) || configured?.bytes;
    if (!Number.isSafeInteger(budget) || budget <= 0) {
      missing.push(name);
      continue;
    }
    declared++;
    const bytes = statSync(f).size;
    if (bytes > budget) over.push({ name: rel(ROOT, f), bytes, budget });
  }
  const unmeasured = candidates.length - declared;
  process.stdout.write(
    `${declared} of ${candidates.length} files have an explicit size budget` +
      (unmeasured ? ` (${unmeasured} UNMEASURED)` : '') + '\n',
  );
  for (const o of over) {
    process.stdout.write(
      `  OVER  ${o.name}: ${fmt(o.bytes)} B > ${fmt(o.budget)} B declared\n`,
    );
  }
  const floorOver = floorBytes > MAX_FLOOR_BYTES;
  process.stdout.write(`  ${floorOver ? 'OVER' : 'OK'} eager Floor: ${fmt(floorBytes)} B / ${fmt(MAX_FLOOR_BYTES)} B aggregate cap\n`);
  for (const name of missing) process.stderr.write(`  UNMEASURED ${name}\n`);
  if (over.length || floorOver || missing.length) {
    if (missing.length) process.stderr.write('Missing explicit instruction/source budget; add a declaration or reviewed policy entry.\n');
    if (over.length) process.stderr.write(`\n${over.length} file(s) over their own declared budget.\n`);
    if (floorOver) process.stderr.write('Eager Floor exceeds the aggregate cap; move task-specific detail to lazy references.\n');
    process.exit(1);
  }
  process.stdout.write('  all candidates have explicit budgets and are within budget\n');
  process.exit(0);
}

if (process.argv.includes('--json')) {
  // The per-skill list has its own key: under `skills` it overwrote the summary of the same name.
  process.stdout.write(JSON.stringify({ ...report, floorRules, skillList: skills }, null, 2) + '\n');
  process.exit(0);
}

const L = [];
L.push('Council instruction-size estimate (bytes / 4; not billed tokens)');
L.push('');
L.push(`  Eager Floor          ~${fmt(report.floor.tokens)} estimated tokens   ${fmt(floorBytes)} B across ${report.floor.files} files`);
L.push(`  Floor + largest skill ~${fmt(report.worstCase.tokens)} estimated tokens   ${report.worstCase.skill ?? '(no skills)'}`);
L.push(`  Path-scoped rules    ${fmt(report.scopedRules.bytes)} B across ${report.scopedRules.files} files (excluded from eager Floor)`);
L.push('');
L.push('  Largest always-on rules');
for (const r of floorRules.slice(0, 6)) {
  L.push(`    ${String(fmt(tok(r.bytes))).padStart(6)} estimated tok  ${r.name}`);
}
L.push('');
L.push(`  Skills over the ${fmt(SKILL_CAP)} B cap: ${report.skills.overCap} of ${report.skills.total}`);
L.push(`    (vendored, not counted: ${[...VENDORED].join(', ')})`);
L.push(`    ~${fmt(report.skills.overCapTokens)} estimated tokens if every one were selected`);
L.push(`    ${report.skills.withProgressiveDisclosure} of ${report.skills.overCap} use progressive disclosure (a routing SKILL.md + references/)`);

if (process.argv.includes('--full')) {
  L.push('');
  L.push('  Every over-cap skill');
  for (const s of over) {
    const refs = s.refs ? ` (${s.refs} refs)` : '  << no references/';
    L.push(`    ${String(fmt(tok(s.bytes))).padStart(6)} estimated tok  ${s.name}${refs}`);
  }
}

L.push('');
L.push('  Static sizes exclude conversation, tool results, matched scopes, extra references and caching.');
L.push('  A gated skill is deferred, not free: when selected it is added to the Floor.');
L.push('  Per CLAUDE.md, anything over the cap should be a routing table plus references/.');
process.stdout.write(L.join('\n') + '\n');
