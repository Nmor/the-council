#!/usr/bin/env node
// Size budget: 12 KB. Check: wc -c; gate: token-budget.mjs --check.
// commit-gate.js
//
// PreToolUse Bash hook. BLOCKS `git commit` (exit 2) when the rules that make a
// commit trustworthy have not actually been met this session. Sister to
// pre-push-gate.js, which guards the remote; this one guards the history.
//
// Enforces, per owner directive "block any push or commit if rule is not checked
// or obeyed or met":
//
//   (a) verify-before-claim.md + done-criteria.md — a verification gate must have
//       RUN, and must have run AFTER the most recent source edit. A gate that ran
//       before the edit proves nothing about what is being committed.
//   (b) functional-test-coverage.md rule 1 — source changed in this session and
//       coverage was never measured once. Coverage is a measurement, never an
//       estimate, and a commit is a claim.
//   (c) plan-execution-progress.md rule 8 — the plan was brought up to date AFTER the
//       code being committed last changed. A task is not complete until the plan says so.
//   (d) docs-sync-with-code.md — a commit carrying code carries docs too, or states in a
//       `Docs:` line why none are needed. Silence is how docs go stale one commit at a time.
//
// (c), (d), and the "source changed" test behind (a) and (b), read what git says is being
// committed. The session edit-stamp alone only ever saw Edit/Write, so a change made through
// Bash was committed with no verification at all. Owner directive (2026-09-21): "plan update
// as tasks are completed and doc updates before code changes are committed or pushed".
//
// Passes through untouched: every non-commit Bash call, and commits that touched
// no source (docs, plans, memory, config-only).
//
// Bypass, deliberately explicit and per-process so it cannot leak across shells:
//   CLAUDE_COMMIT_GATE=off git commit -m "..."
// Use it when a gate is genuinely unavailable, and say so in the commit body.
"use strict";
const { markerPath, readPrivate } = require('./lib/private-state.js');
const fs = require("fs");
const path = require("path");
const gs = require("./lib/git-state.js");
const pc = require("./lib/project-context.js");
const { proofFor, stagedMatches } = require("./lib/verification.js");

const { commandInvocations, gitOperation } = require('./lib/command-scan.js');
const PREFIX = '[commit-gate] ';

function commitCalls(command, cwd) {
  let directory = cwd;
  const commits = [];
  for (const call of commandInvocations(command)) {
    if (call.argv[0] === 'cd' && call.argv.length === 2) directory = path.resolve(directory, call.argv[1]);
    const operation = gitOperation(call.argv);
    if (operation.operation !== 'commit' || call.assignments.CLAUDE_COMMIT_GATE === 'off') continue;
    let target = directory;
    for (let i = 1; i < call.argv.length - operation.args.length - 1; i++) {
      if (call.argv.at(i) === '-C') { target = path.resolve(target, call.argv.at(i + 1)); i++; }
      else if (call.argv.at(i).startsWith('-C')) target = path.resolve(target, call.argv.at(i).slice(2));
    }
    commits.push({ ...call, args: operation.args, directory: target });
  }
  return commits;
}

function commitsAll(args) {
  let all = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args.at(i);
    if (arg === '--') break;
    if (arg === '-m' || arg === '--message' || arg === '-F' || arg === '--file') { i++; continue; }
    if (arg === '--no-all') all = false;
    else if (arg === '--all' || (arg.startsWith('-') && !arg.startsWith('--') && arg.slice(1).split('m')[0].split('F')[0].includes('a'))) all = true;
  }
  return all;
}

// `--amend --no-edit` on an already-verified commit, and `-m` on a revert, do not
// re-introduce unverified work; the edit/gate timestamps below still govern them.
const readStamp = (p) => {
  // Parse only the FIRST line: the marker's second line carries the prompt_id of the turn
  // the gate ran in (verify-before-claim.md r3 turn-scoping). Reading the whole file as a
  // number yields NaN once that line exists, which reads as "no gate ran" and blocks every
  // commit. Measured 2026-09-21 when the second line was introduced.
  try {
    const first = String(readPrivate(p)).split("\n")[0].trim();
    const n = Number(first);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
};

// The commit message, wherever the command put it: inline (-m, heredoc) or in a file (-F).
function messageOf(call, directory) {
  const messages = [call.input || ''];
  for (let i = 0; i < call.args.length; i++) {
    const arg = call.args.at(i);
    if (arg === '-m' || arg === '--message') { messages.push(call.args.at(++i) || ''); continue; }
    if (arg.startsWith('--message=')) { messages.push(arg.slice(10)); continue; }
    let file;
    if (arg === '-F' || arg === '--file') file = call.args.at(++i);
    else if (arg.startsWith('--file=')) file = arg.slice(7);
    if (!file || file === '-') continue;
    try { messages.push(fs.readFileSync(path.resolve(directory, file), 'utf8')); }
    catch { process.stderr.write(`${PREFIX}commit message file unavailable\n`); }
  }
  return messages.join('\n');
}

function planReasons(root, sourceCount, sourceMtime) {
  if (!sourceCount) return [];
  const plan = pc.activePlan(root);
  if (plan.state !== 'set' || plan.mtime >= sourceMtime) return [];
  return [`the plan was last updated BEFORE the code in this commit changed (${path.basename(plan.path)}). ` +
    'Per plan-execution-progress.md rule 8 update the task and its verification outcome before committing.'];
}

function reasonsFor(call, payload) {
  const sid = payload.session_id;
  const pid = payload.prompt_id || '';
  const dir = call.directory;
  // What this commit records, according to git.
  const root = gs.repoRoot(dir);
  const all = commitsAll(call.args);
  const files = root ? gs.commitFiles(root, all) : [];
  const code = files.filter((f) => gs.classify(f) === "code");
  const tests = files.filter((f) => gs.classify(f) === "test");
  const docs = files.filter((f) => gs.classify(f) === "docs");
  const sourceMtime = root ? gs.newestMtime(root, [...code, ...tests]) : 0;

  const lastEdit = Math.max(
    readStamp(markerPath('lastedit', sid)),
    sourceMtime,
  );
  const proofInput = { session_id: sid, cwd: dir };
  const verification = proofFor('gate', proofInput);
  const lastGate = verification?.at || 0;
  const gateIsThisTurn = Boolean(pid) && verification?.prompt === pid;
  const coverageProof = proofFor('coverage', proofInput);
  const coverage = coverageProof && coverageProof.at >= lastEdit;

  // No source touched this session and none being committed: nothing to assert.
  if (!lastEdit) return [];

  const reasons = [];
  if (root && !all && (code.length || tests.length) && !stagedMatches(root, [...code, ...tests])) {
    reasons.push('staged source differs from the tested working tree; stage the intended source and re-run verification.');
  }
  if (!lastGate) {
    reasons.push(
      "no verification gate has run this session (build / test / lint / vet / type-check). " +
        "Per verify-before-claim.md a commit is a claim, and a claim needs same-session proof.",
    );
  } else if (pid && !gateIsThisTurn) {
    reasons.push(
      "the last verification gate ran in an EARLIER TURN. Per verify-before-claim.md " +
        "rule 3 verification is scoped to THIS turn, not the session — files have changed " +
        "since. Re-run the gate.",
    );
  } else if (lastGate < lastEdit) {
    const mins = Math.round((lastEdit - lastGate) / 60000);
    reasons.push(
      `source changed AFTER the last verification gate ran (${mins} min later). ` +
        "The earlier run proves nothing about what is staged — re-run the gate.",
    );
  }
  if (!coverage) {
    reasons.push(
      "coverage was never measured this session, though source changed. Per " +
        "functional-test-coverage.md rule 1 coverage is a measurement and never an " +
        "estimate; run the project coverage command before committing.",
    );
  }

  reasons.push(...planReasons(root, code.length + tests.length, sourceMtime));
  if (
    code.length &&
    !docs.length &&
    !gs.DOCS_DECLARATION.test(messageOf(call, root || dir))
  ) {
    reasons.push(
      `this commit changes ${code.length} source file(s) and no documentation. Per ` +
        "docs-sync-with-code.md, stage the docs this change affects (README, feature page, " +
        "runbook, CHANGELOG, API docs) — or, if it genuinely changes nothing a reader relies " +
        'on, say so in the message with a line such as "Docs: none — internal refactor, no ' +
        'behaviour change". The line is the recorded decision; its absence is the omission.',
    );
  }

  return reasons;
}

function handle(payload) {
  if (!payload.session_id || process.env.CLAUDE_COMMIT_GATE === 'off') return;
  const command = payload.tool_input?.command || '';
  const calls = commitCalls(command, payload.cwd || process.cwd());
  const reasons = calls.flatMap(call => reasonsFor(call, payload));
  if (!reasons.length) return;
  process.stderr.write(`${PREFIX}BLOCKED: ${reasons.length} rule(s) not met.\n` +
    reasons.map((reason, i) => `${PREFIX}  ${i + 1}. ${reason}\n`).join('') +
    `${PREFIX}Fix each, then commit. Override only the unavailable gate's commit with ` +
    'CLAUDE_COMMIT_GATE=off git commit ... (record why in the commit body).\n');
  process.exitCode = 2;
}

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { buf += chunk; });
process.stdin.on('end', () => {
  let payload;
  try { payload = JSON.parse(buf); }
  catch { return; }
  try { handle(payload); }
  catch { process.stderr.write(`${PREFIX}input or verification unavailable\n`); process.exitCode = 2; }
});
