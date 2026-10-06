// Size budget: 8 KB. Check: wc -c; gate: token-budget.mjs --check.
//
// What git says has changed, for the gates that enforce "plan updated as tasks complete" and
// "docs updated before code is committed or pushed".
//
// WHY GIT AND NOT SESSION MARKERS. Those gates used to learn about changes from a PostToolUse
// marker on Edit/Write. That marker never saw a change made through Bash — a sed, a heredoc, a
// python rewrite — which in some sessions is most of the work, so the gates were blind exactly
// where they were needed. Git sees every change however it was made, and for a commit or a
// push it states precisely what is about to become history.
'use strict';
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SRC_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|kts|cs|rb|php|swift|sql|vue|svelte)$/i;
const TEST_DIR = /(^|\/)(__tests__|tests?|spec)\//i;
const TEST_FILE = /[._-](test|spec)\.[a-z]+$|_test\.go$|(^|\/)test_[^/]+\.py$/i;
const isTest = (s) => TEST_DIR.test(s) || TEST_FILE.test(s);

function git(cwd, args) {
  try {
    return execFileSync('git', ['-C', cwd, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    });
  } catch {
    return null; // not a repo, no upstream, git missing — each caller treats null as "unknown"
  }
}

const repoRoot = (cwd) => (git(cwd, ['rev-parse', '--show-toplevel']) || '').trim() || null;

/** The directory a git command acts on: `git -C <dir>`, or a leading `cd <dir> &&`. */
function targetDir(cmd, cwd) {
  const c = /\bgit\s+-C\s+("[^"]+"|'[^']+'|\S+)/.exec(cmd);
  const d = /^\s*cd\s+("[^"]+"|'[^']+'|\S+)\s*&&/.exec(cmd);
  const pick = (c && c[1]) || (d && d[1]);
  if (!pick) return cwd;
  const dir = pick.replace(/^["']|["']$/g, '').replace(/^~(?=\/|$)/, os.homedir());
  return path.resolve(cwd || '.', dir);
}

/**
 * code | test | docs | null. Paths under `.claude/` are neither product code nor product
 * docs (plans and memory are gitignored runtime state), so they never trip a docs check.
 */
function classify(p) {
  const s = String(p).replace(/\\/g, '/');
  if (/(^|\/)\.claude\//.test(s)) return null;
  if (/\.(md|mdx|rst|adoc)$/i.test(s) || /(^|\/)docs?\//i.test(s)) return 'docs';
  if (SRC_EXT.test(s)) return isTest(s) ? 'test' : 'code';
  return null;
}

const lines = (out) => (out ? out.split('\n').map((l) => l.trim()).filter(Boolean) : []);

/** Files a commit will record: the index, or every tracked change for `commit -a`. */
function commitFiles(root, all) {
  return lines(git(root, all ? ['diff', '--name-only', 'HEAD'] : ['diff', '--cached', '--name-only']));
}

/** Uncommitted changes in the working tree, tracked and untracked.
 * NUL-separated: the line form fed through lines() TRIMMED ` M app.py` to `M app.py`
 * before slice(3), yielding `pp.py` — so EDITS to tracked files (the normal mid-task
 * state) carried no evidence and only new `??` files ever tripped the gates. */
function dirtyFiles(root) {
  const out = git(root, ['status', '--porcelain', '-z', '--untracked-files=all']);
  const files = [];
  let origin = false; // -z: the field after a rename/copy entry is its origin path
  for (const field of (out ? out.split('\0') : []).filter(Boolean)) {
    if (origin) {
      origin = false;
      continue;
    }
    files.push(field.slice(3));
    origin = /^[RC]/.test(field);
  }
  return files;
}

/** Files recorded by commits created since `sinceMs`, and the newest commit time.
 * A clean tree at Stop usually means the session COMMITTED its work; `git status`
 * alone forgets that. Bounded to the last 50 commits and filtered on committer time
 * here (not `--since`, whose stop-at-first-old semantics and author/committer
 * ambiguity make fixtures nondeterministic). */
function commitsSince(root, sinceMs) {
  if (!sinceMs) return { files: [], lastMs: 0 };
  const out = git(root, ['log', '-50', '--pretty=format:\x01%ct', '--name-only']);
  const files = new Set();
  let lastMs = 0;
  let take = false;
  // %ct is whole seconds while sinceMs carries milliseconds: a commit in the same
  // second as session start truncates below it. Count it — a spurious nudge is
  // cheaper than silently forgetting the session's landing commit.
  const floorMs = Math.floor(sinceMs / 1000) * 1000;
  for (const raw of (out || '').split('\n')) {
    if (!raw) continue;
    if (raw.charCodeAt(0) === 1) {
      const ms = (Number(raw.slice(1)) || 0) * 1000;
      take = ms >= floorMs;
      if (take) lastMs = Math.max(lastMs, ms);
      continue;
    }
    if (take) files.add(raw.replace(/^"|"$/g, ''));
  }
  return { files: [...files], lastMs };
}

/** Code/test changes since `sinceMs` — dirty OR committed — from cwd's repo, or from
 * the immediate child repositories when cwd is a multi-repo workspace root (the layout
 * these sessions actually run in; deeper nesting stays out of scope, bounded). */
function evidenceRoots(cwd) {
  const own = repoRoot(cwd);
  if (own) return [[own, '']];
  const roots = [];
  try {
    for (const entry of fs.readdirSync(cwd, { withFileTypes: true })) {
      if (roots.length >= 24) break;
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const dir = path.join(cwd, entry.name);
      if (fs.existsSync(path.join(dir, '.git'))) roots.push([dir, `${entry.name}/`]);
    }
  } catch {
    /* unreadable cwd: no git evidence to offer */
  }
  return roots;
}

const interesting = (f) => ['code', 'test'].includes(classify(f));

function repoEvidence(root, sinceMs) {
  const dirty = dirtyFiles(root)
    .filter(interesting)
    .filter((f) => newestMtime(root, [f]) > sinceMs);
  const committed = commitsSince(root, sinceMs);
  const landed = committed.files.filter(interesting);
  return {
    files: [...new Set([...dirty, ...landed])],
    time: Math.max(newestMtime(root, dirty), landed.length ? committed.lastMs : 0),
  };
}

function changedSince(cwd, sinceMs) {
  const changed = [];
  let codeTime = 0;
  for (const [root, prefix] of evidenceRoots(cwd)) {
    const found = repoEvidence(root, sinceMs);
    codeTime = Math.max(codeTime, found.time);
    for (const f of found.files) changed.push(prefix + f);
  }
  return { changed, codeTime };
}

function newestMtime(root, files) {
  let t = 0;
  for (const f of files) {
    try {
      t = Math.max(t, fs.statSync(path.join(root, f)).mtimeMs);
    } catch {
      /* deleted in this change — a deletion has no mtime to compare */
    }
  }
  return t;
}

/** Commits on HEAD that no remote-tracking ref has yet: exactly what a push publishes. */
function unpushedCommits(root) {
  return lines(git(root, ['rev-list', 'HEAD', '--not', '--remotes'])).map((sha) => ({
    sha,
    files: lines(git(root, ['diff-tree', '--no-commit-id', '--name-only', '-r', '--root', sha])),
    body: git(root, ['log', '-1', '--format=%B', sha]) || '',
  }));
}

/** An explicit, recorded decision that a code change needs no documentation. */
const DOCS_DECLARATION = /(^|\n|\\n|["'\s])Docs:\s*\S/;

module.exports = {
  repoRoot, targetDir, classify, commitFiles, changedSince, commitsSince, dirtyFiles, newestMtime,
  unpushedCommits, DOCS_DECLARATION,
};
