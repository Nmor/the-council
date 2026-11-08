// Size budget: 8 KB. Check: token-budget.mjs --check.
"use strict";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");

function checkedStat(file, directory = false, owned = true) {
  const stat = fs.lstatSync(file);
  if (
    stat.isSymbolicLink() ||
    (directory ? !stat.isDirectory() : !stat.isFile())
  ) {
    throw new Error("unsafe state path");
  }
  if (owned && process.getuid && stat.uid !== process.getuid())
    throw new Error("foreign state owner");
  return stat;
}

function privateDirectory(directory) {
  const parent = path.dirname(directory);
  if (parent !== directory && !fs.existsSync(parent)) privateDirectory(parent);
  if (fs.existsSync(parent)) checkedStat(parent, true, false);
  try {
    fs.mkdirSync(directory, { mode: 0o700 });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  checkedStat(directory, true);
  fs.chmodSync(directory, 0o700);
  return directory;
}

function markerPath(kind, session, temporary = os.tmpdir()) {
  if (
    !/^[a-z-]+$/.test(kind) ||
    typeof session !== "string" ||
    !/^[A-Za-z0-9_.-]{1,200}$/.test(session)
  )
    throw new Error("invalid state key");
  const identity = createHash("sha256")
    .update(os.userInfo().username)
    .digest("hex")
    .slice(0, 16);
  const directory = path.join(temporary, `council-private-${identity}`);
  const key = createHash("sha256").update(session).digest("hex");
  return path.join(directory, `${kind}-${key}.json`);
}

function readPrivate(file, { allowPublicFile = false } = {}) {
  const directory = checkedStat(path.dirname(file), true);
  if (process.platform !== "win32" && directory.mode & 0o077)
    throw new Error("public state directory");
  checkedStat(file);
  const descriptor = fs.openSync(
    file,
    fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0),
  );
  try {
    const stat = fs.fstatSync(descriptor);
    if (!stat.isFile() || (process.getuid && stat.uid !== process.getuid()))
      throw new Error("unsafe state file");
    if (!allowPublicFile && process.platform !== "win32" && stat.mode & 0o077)
      throw new Error("public state file");
    if (stat.size > 1024 * 1024) throw new Error("state exceeds read limit");
    return fs.readFileSync(descriptor, "utf8");
  } finally {
    fs.closeSync(descriptor);
  }
}

function writePrivate(file, text) {
  privateDirectory(path.dirname(file));
  try {
    checkedStat(file);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const temporary = path.join(path.dirname(file), `.write-${randomUUID()}`);
  try {
    const descriptor = fs.openSync(temporary, "wx", 0o600);
    try {
      fs.writeFileSync(descriptor, text, "utf8");
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
    fs.renameSync(temporary, file);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

function removePrivate(file) {
  try {
    checkedStat(path.dirname(file), true);
    checkedStat(file);
    fs.unlinkSync(file);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

function hasPrivate(file) {
  try {
    readPrivate(file);
    return true;
  } catch (error) {
    if (error.code !== "ENOENT")
      process.stderr.write(
        "[private-state] unsafe or unreadable marker ignored\n",
      );
    return false;
  }
}

function pruneSessions(directory, now = Date.now()) {
  privateDirectory(directory);
  for (const name of fs.readdirSync(directory)) {
    if (!/^\d{4}-\d{2}-\d{2}-[A-Za-z0-9_-]+-session\.tmp$/.test(name)) continue;
    const file = path.join(directory, name);
    const stat = checkedStat(file);
    if (now - stat.mtimeMs > 30 * 24 * 60 * 60 * 1000) removePrivate(file);
  }
}

// councilProof writes the agent-neutral proof the repository's own pre-commit hook reads
// (.council/proofs/<kind>.json, gitignored). The Claude hooks bind one tool; that git hook binds
// every agent and every human using the repository, so both enforcement paths read ONE proof
// rather than each trusting its own. Bound to a tree, so another agent's unrelated edits cannot
// invalidate it. Best-effort: a repository that has not installed the hook simply has no
// directory to write into, and nothing here should fail a review because of that.
// Repositories a review brief names, so the proof is written where the REVIEWED code lives.
// This hook fires with the session's working directory, which in a workspace of many
// repositories is routinely not the one under review — the proof then landed in the wrong
// repository, or nowhere, and the gate was unsatisfiable however real the review had been.
// A brief names its repository because a reviewer needs the path to read anything.
// A path quoted in prose carries the sentence's punctuation. Trimmed by hand rather than by a
// pattern: a repeated character class anchored at the end is the shape that backtracks.
function withoutTrailingPunctuation(token) {
  let end = token.length;
  while (end > 0 && ".,;:)'\"`".includes(token[end - 1])) end -= 1;
  return token.slice(0, end);
}

function repoRootOf(target) {
  try {
    if (!fs.existsSync(target)) return "";
    const directory = fs.statSync(target).isDirectory()
      ? target
      : path.dirname(target);
    return require("./git-state.js").repoRoot(directory) || "";
  } catch {
    return ""; // an unreadable path names no repository
  }
}

function reviewedRoots(text, fallback) {
  const roots = new Set();
  // Split on whitespace rather than scanning prose with a pattern: a repeated character class
  // over arbitrary text is the shape that backtracks, and a path is a whitespace-bounded token.
  for (const token of String(text || "").split(/\s+/)) {
    if (token.length < 4 || !token.startsWith("/")) continue;
    const root = repoRootOf(withoutTrailingPunctuation(token));
    if (root) roots.add(root);
  }
  // No path named: the session's own repository is the only remaining candidate.
  if (!roots.size && fallback) {
    const root = repoRootOf(fallback);
    if (root) roots.add(root);
  }
  return [...roots];
}

function councilProof(root, kind, payload) {
  if (!root || !/^[a-z]+$/.test(kind)) return;
  try {
    const directory = path.join(root, ".council", "proofs");
    if (!fs.existsSync(directory)) return;
    fs.writeFileSync(
      path.join(directory, `${kind}.json`),
      `${JSON.stringify(payload)}\n`,
      { mode: 0o600 },
    );
  } catch {
    /* evidence is written where it can be; its absence blocks, never crashes */
  }
}

module.exports = {
  councilProof,
  reviewedRoots,
  markerPath,
  privateDirectory,
  readPrivate,
  writePrivate,
  removePrivate,
  hasPrivate,
  pruneSessions,
};
