// Size budget: 4 KB. Check: token-budget.mjs --check.
// The source a verification proof is bound to: a check proves the tree it ran against.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const gs = require('./git-state.js');

const GIT = ['/usr/bin/git', '/usr/local/bin/git', '/opt/homebrew/bin/git',
  path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'cmd', 'git.exe')]
  .find(file => fs.existsSync(file));

// Tracked files are named by the blob ids the index holds, and only files git reports as
// differing from it are read, so the cost follows the change, not the repository, whose size
// once refused every proof. git compares content when only a file's stat changed.
function sourceState(directory) {
  const root = gs.repoRoot(directory);
  if (!root) return null;
  if (!GIT) throw new Error('git executable unavailable');
  const git = (args, input) => execFileSync(GIT, args, { cwd: root, encoding: 'utf8', timeout: 3000,
    maxBuffer: 8 * 1024 * 1024, input, stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe'] });
  const source = file => ['code', 'test'].includes(gs.classify(file));
  const hash = createHash('sha256');
  const tracked = new Set();
  for (const entry of git(['ls-files', '--stage', '-z']).split('\0').filter(Boolean)) {
    const file = entry.slice(entry.indexOf('\t') + 1);
    if (source(file)) { hash.update(`index\0${entry}\0`); tracked.add(file); }
  }
  const differ = git(['ls-files', '-z', '--modified', '--others', '--exclude-standard']).split('\0');
  const edited = [];
  let bytes = 0;
  for (const file of [...new Set(differ.filter(f => f && source(f)))].sort()) {
    const target = path.join(root, file);
    if (!fs.existsSync(target)) { hash.update(`${file}\0deleted\0`); continue; }
    if (!fs.lstatSync(target).isFile()) throw new Error('nonregular verification source');
    if (tracked.has(file)) { edited.push(file); continue; }
    const content = fs.readFileSync(target);
    bytes += content.length;
    if (bytes > 16 * 1024 * 1024) throw new Error('untracked verification source exceeds bound');
    hash.update(`${file}\0${content.length}\0`).update(content);
  }
  const ids = edited.length ? git(['hash-object', '--stdin-paths'], `${edited.join('\n')}\n`).split('\n') : [];
  edited.forEach((file, i) => hash.update(`worktree\0${file}\0${ids[i]}\0`));
  return { root, digest: hash.digest('hex') };
}

// The tree a plain commit records: the index's content, by object id. Binding a proof to this
// rather than the whole worktree lets it survive another agent editing unrelated files, and
// follows the private index a commit actually uses (GIT_INDEX_FILE).
function candidateTree(directory, indexFile) {
  const root = gs.repoRoot(directory);
  if (!root || !GIT) return null;
  try {
    const env = { ...process.env };
    if (indexFile) env.GIT_INDEX_FILE = indexFile; else delete env.GIT_INDEX_FILE;
    const tree = execFileSync(GIT, ['write-tree'], { cwd: root, encoding: 'utf8', env,
      timeout: 3000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    return /^[a-f0-9]{40,64}$/.test(tree) ? tree : null;
  } catch { return null; }
}

// Object ids in a review brief that really are trees here. A review naming the tree it was given
// binds its proof to that artifact, so it stays valid across turns and across another agent's
// edits — "this artifact is unchanged" being stronger than "the worktree is unchanged".
function treesNamedIn(text, directory) {
  const root = gs.repoRoot(directory);
  if (!root || !GIT || !text) return [];
  const named = [...new Set(String(text).match(/\b[a-f0-9]{40,64}\b/g) || [])].slice(0, 8);
  return named.filter(id => {
    try {
      return execFileSync(GIT, ['cat-file', '-t', id], { cwd: root, encoding: 'utf8',
        timeout: 3000, stdio: ['ignore', 'pipe', 'pipe'] }).trim() === 'tree';
    } catch { return false; }
  });
}

module.exports = { sourceState, candidateTree, treesNamedIn, GIT };
