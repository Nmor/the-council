// Size budget: 8 KB. Check: token-budget.mjs --check.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { devNull } = require('node:os');
const { execFileSync, spawnSync } = require('node:child_process');
const { classify, DOCS_DECLARATION } = require('./git-state.js');
const { verificationProblems } = require('./committed-checks.js');
const { acceptedTip } = require('./accepted-tip.js');
const OID = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/;

function git(root, args) {
  return gitBytes(root, args).toString('utf8').trimEnd();
}

function gitBytes(root, args, input) {
  return execFileSync('git', ['-C', root, ...args], {
    input, timeout: 10000, maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, GIT_NO_REPLACE_OBJECTS: '1', GIT_GRAFT_FILE: devNull },
    stdio: ['ignore', 'pipe', 'pipe'],
    ...(input === undefined ? {} : { stdio: ['pipe', 'pipe', 'pipe'] }),
  });
}

function commitInfo(root, commit) {
  if (!OID.test(commit)) throw new Error('invalid commit object id');
  const [sha, tree, seconds] = git(root, ['show', '-s', '--format=%H%n%T%n%ct', commit]).split('\n');
  if (sha !== commit || !OID.test(tree)) throw new Error('commit identity unavailable');
  const files = git(root, ['diff-tree', '--root', '-m', '-r', '--no-commit-id', '--name-only', '-z', commit])
    .split('\0').filter(Boolean);
  return { commit, tree, at: Number(seconds) * 1000, files };
}

function validTime(at, committedAt) {
  return Number.isFinite(at) && at >= committedAt && at <= Date.now() + 10000;
}

function readProof(root, info, kind) {
  const file = path.join(root, '.council', 'proofs', 'commits', info.commit, `${kind}.json`);
  const proof = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (proof.commit !== info.commit || proof.tree !== info.tree || !validTime(proof.at, info.at))
    throw new Error(`${kind} evidence must name this commit and tree and follow its creation`);
  return proof;
}

function ancestor(root, before, after) {
  const result = spawnSync('git', ['-C', root, 'merge-base', '--is-ancestor', before, after], {
    encoding: 'utf8', timeout: 10000,
    env: { ...process.env, GIT_NO_REPLACE_OBJECTS: '1', GIT_GRAFT_FILE: devNull },
  });
  if (result.error || result.signal || ![0, 1].includes(result.status))
    throw new Error('cannot verify corrective-commit ancestry');
  return result.status === 0;
}

function resolutionProblems(root, info, review, tips) {
  if (review.resolved_by === undefined) return [];
  if (!Array.isArray(review.resolved_by) || !review.resolved_by.length || review.resolved_by.length > 64)
    return ['invalid corrective-commit references'];
  const containing = tips.filter(tip => ancestor(root, info.commit, tip));
  for (const fix of review.resolved_by) {
    if (!OID.test(fix) || fix === info.commit || !ancestor(root, info.commit, fix) ||
        !containing.length || containing.some(tip => !ancestor(root, fix, tip)))
      return ['every pushed tip containing this commit must include its reviewed corrections'];
    commitInfo(root, fix);
  }
  return [];
}

function problemsFor(root, commit, tips = [commit]) {
  const info = commitInfo(root, commit);
  const problems = [];
  const code = info.files.some(file => classify(file) === 'code');
  try {
    const review = readProof(root, info, 'review');
    const reviewers = new Set((review.reviewers || []).filter(name => typeof name === 'string' && name.trim()));
    if (review.verdict !== 'approved' || review.findings_remaining !== 0 || reviewers.size < (code ? 2 : 1))
      problems.push('independent post-commit review is incomplete or has unresolved findings');
    problems.push(...resolutionProblems(root, info, review, tips));
  } catch (e) { problems.push(`commit-bound post-commit review unusable: ${e.message}`); }
  try {
    const gate = readProof(root, info, 'gate');
    let receipts = [gate];
    if (gate.resolved_by !== undefined) {
      problems.push(...resolutionProblems(root, info, gate, tips));
      receipts = Array.isArray(gate.resolved_by) ? gate.resolved_by.map(fix => {
        const fixed = readProof(root, commitInfo(root, fix), 'gate');
        if (fixed.resolved_by !== undefined) throw new Error('verification needs a terminal successful correction');
        return fixed;
      }) : [];
    }
    problems.push(...verificationProblems(gate, receipts, code));
  } catch (e) { problems.push(`commit-bound post-commit verification unusable: ${e.message}`); }
  if (code && !info.files.some(file => classify(file) === 'docs') &&
      !DOCS_DECLARATION.test(git(root, ['show', '-s', '--format=%B', commit])))
    problems.push('source commit needs documentation or a Docs: decision');
  return problems;
}

function conditionalProblems(root, tips) {
  const folder = path.join(root, '.council', 'proofs', 'commits');
  if (!fs.existsSync(folder)) return [];
  const entries = fs.readdirSync(folder, { withFileTypes: true });
  if (entries.length > 10000) throw new Error('conditional proof census exceeds limit');
  const failures = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !OID.test(entry.name)) continue;
    const kinds = ['review', 'gate'].filter(kind => fs.existsSync(path.join(folder, entry.name, `${kind}.json`)));
    if (!kinds.length) continue;
    const query = `${entry.name}^{commit}`;
    const object = gitBytes(root, ['cat-file', '--batch-check'], `${query}\n`).toString('ascii').trimEnd();
    if (object === `${query} missing`) continue;
    if (!new RegExp(`^${entry.name} commit [0-9]+$`).test(object))
      throw new Error('cannot check conditional original object');
    if (!tips.some(tip => ancestor(root, entry.name, tip))) continue;
    const info = commitInfo(root, entry.name);
    for (const kind of kinds) {
      const proof = readProof(root, info, kind);
      if (proof.resolved_by === undefined) continue;
      failures.push(...resolutionProblems(root, info, proof, tips).map(reason => `${entry.name.slice(0, 12)}: ${reason}`));
      if (kind === 'gate') failures.push(...problemsFor(root, entry.name, tips).map(reason => `${entry.name.slice(0, 12)}: ${reason}`));
    }
  }
  return failures;
}

function outgoing(root, remote, updates, url) {
  if (typeof remote !== 'string' || !remote) throw new Error('Git push destination unavailable');
  if (git(root, ['rev-parse', '--is-shallow-repository']) !== 'false')
    throw new Error('full history is required to verify outgoing commits; fetch unshallow first');
  const commits = new Set();
  const accepted = acceptedTip(root, url, { git, OID });
  for (const update of updates) {
    const fields = update.split(/\s+/);
    if (fields.length !== 4 || !OID.test(fields[1]) || !OID.test(fields[3]))
      throw new Error('invalid Git pre-push update');
    const [, local, , previous] = fields;
    if (/^0+$/.test(local)) continue;
    // Cached tracking refs can be stale or belong to a different fetch endpoint.
    // Only this push's old destination object and the live default branch exclude.
    const omit = [...accepted, ...(/^0+$/.test(previous) ? [] : [previous])];
    const result = git(root, ['rev-list', '--reverse', local, '--not', ...omit]);
    for (const commit of result.split('\n').filter(Boolean)) commits.add(commit);
    if (commits.size > 10000) throw new Error('push exceeds the bounded commit census');
  }
  return [...commits];
}

module.exports = { commitInfo, git, gitBytes, outgoing, problemsFor, conditionalProblems };
