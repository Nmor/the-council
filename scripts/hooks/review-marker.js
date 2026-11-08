#!/usr/bin/env node
// Size budget: 6 KB. Check: token-budget.mjs --check.
// review-marker.js
//
// PostToolUse on Agent/Task/Skill, and SubagentStop. Records that an INDEPENDENT review actually
// ran, so a commit can require one (done-criteria.md).
//
// Why: every gate passed on a commit that granted a stored credential Super Admin. No gate reads code.
//
// Bound to the committed tree, else the worktree digest and turn; also publishes
// .council/proofs/review.json for any agent's pre-commit hook (review-proof-protocol.md).
'use strict';
const { createHash, randomUUID } = require('node:crypto');
const { readInput, agentReport } = require('./lib/lifecycle-context.js');
const { markerPath, writePrivate, readPrivate, councilProof, reviewedRoots } = require('./lib/private-state.js');
const { terminalSuccess, sourceState, councilProofFor } = require('./lib/verification.js');
const { candidateTree, treesNamedIn } = require('./lib/source-state.js');

// Agents whose whole job is reading someone else's code. A general-purpose agent is NOT here:
// "an agent looked at it" would make the requirement satisfiable by its own gap.
const REVIEWERS = new Set([...('code architect go python java typescript ruby php rust dotnet ' +
  'security database infra ops mobile performance payments compliance data accessibility ux ' +
  'comms ai-ethics risk finance health education esg people strategy').split(' ')
  .map(name => (name === 'architect' ? name : `${name}-reviewer`)),
'claude-security:patch-verifier', 'claude-security:scan-verifier']);

// Reviews run through a skill rather than as a subagent.
const REVIEW_SKILLS = new Set(['code-review', 'go-review', 'python-review', 'security-review',
  'claude-security:claude-security']);

function reviewerOf(input) {
  const tool = input.tool_name;
  const args = input.tool_input || {};
  if (tool === 'Agent' || tool === 'Task') {
    const type = String(args.subagent_type || '').trim();
    return REVIEWERS.has(type) ? `agent:${type}` : '';
  }
  if (tool === 'Skill') {
    const skill = String(args.skill || '').trim();
    return REVIEW_SKILLS.has(skill) ? `skill:${skill}` : '';
  }
  return '';
}

// A background reviewer is only observable at SubagentStop: its PostToolUse is `async_launched`.
const REPORT_WAIT_MS = 8000;
const REPORT_POLL_MS = 200;

function stoppedReviewer(input) {
  const type = String(input.agent_type || '').trim();
  if (!REVIEWERS.has(type)) return null;
  // A hand-back report can reach the transcript after this event (measured), so wait, bounded.
  const last = typeof input.last_assistant_message === 'string' ? input.last_assistant_message : '';
  const started = Date.now();
  let parsed = agentReport(input.agent_transcript_path);
  while (!last.trim() && !parsed.report.trim() && Date.now() - started < REPORT_WAIT_MS) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, REPORT_POLL_MS);
    parsed = agentReport(input.agent_transcript_path);
  }
  const brief = parsed.brief;
  const report = last.trim() ? last : parsed.report;
  if (!report.trim()) return null; // Stopping is not reviewing: it answered nothing.
  // Both halves: the brief names the repository, the report names what was actually read.
  return { reviewer: `agent:${type}`, brief: `${brief}\n${report}` };
}

function completedReview(input) {
  const reviewer = reviewerOf(input);
  // Interrupted, backgrounded or failed proves nothing: the bar every proof is held to.
  if (!reviewer || !terminalSuccess(input.tool_response, input.hook_event_name)) return null;
  return { reviewer, brief: input.tool_input?.prompt || input.tool_input?.args || '' };
}

// Scoped allowlist, not the shared EVENTS set: that one also governs what may emit context.
readInput('review-marker', input => {
  const found = input.hook_event_name === 'SubagentStop'
    ? stoppedReviewer(input)
    : completedReview(input);
  if (!found || !input.session_id) return;
  const reviewer = found.reviewer;
  let source = null;
  try {
    source = sourceState(input.cwd || process.cwd());
  } catch {
    return; // Outside a repository, or a tree with no takeable digest: no proof to write.
  }
  if (!source) return;
  const marker = markerPath('review', input.session_id);
  // Reviewers ACCUMULATE, so depth is a set of perspectives rather than whichever ran last.
  const prompt = input.prompt_id || '';
  let reviewers = [];
  try {
    const previous = JSON.parse(String(readPrivate(marker)));
    const tree = candidateTree(input.cwd || process.cwd());
    // Same artifact, or same turn and worktree: either way they reviewed what is here now.
    if ((tree && previous.tree === tree) || (previous.prompt === prompt &&
        JSON.stringify(previous.source) === JSON.stringify(source))) {
      reviewers = Array.isArray(previous.reviewers) ? previous.reviewers : [];
    }
  } catch {
    reviewers = [];
  }
  if (!reviewers.includes(reviewer)) reviewers.push(reviewer);
  const cwd = input.cwd || process.cwd();
  const brief = found.brief;
  const tree = candidateTree(cwd);
  writePrivate(marker, JSON.stringify({
    version: 2, at: Date.now(), prompt,
    attempt: input.tool_use_id || randomUUID(), verified: true,
    command_digest: createHash('sha256').update(reviewers.join('|')).digest('hex'),
    exit_code: 0, reviewer, reviewers, tree, source,
  }));
  // Each repository the brief NAMES (not the session's cwd), bound to its index tree and any
  // tree the brief names (work composed in a private GIT_INDEX_FILE).
  const at = Date.now();
  for (const root of reviewedRoots(brief, cwd)) {
    const trees = [...new Set([candidateTree(root), ...treesNamedIn(brief, root)].filter(Boolean))];
    if (!trees.length) continue;
    // Only reviewers of THIS repository and tree: the session marker pools every reviewer.
    const prior = trees.map(tree => councilProofFor(root, 'review', tree)).find(Boolean);
    const named = [...new Set([...(prior ? prior.reviewers : []), reviewer])];
    councilProof(root, 'review', { trees, reviewers: named, at });
  }
}, new Set(['PostToolUse', 'SubagentStop']));
