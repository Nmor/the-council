// Size budget: 8 KB. Check: wc -c; gate: token-budget.mjs --check.
// Regression tests for review-marker.js — the recorder behind the pre-commit REVIEW gate.
//
// This hook had no tests, and that is how it shipped unsatisfiable. Its success predicate was
// Bash-shaped (stdout / exit_code), while a dispatched reviewer answers with a STATUS, so no
// agent review was ever recorded. Measured on 2026-10-29: a real go-reviewer read a repository,
// reported a real defect, and left no proof — the gate could not be satisfied by a review that
// had genuinely happened, which is the failure mode that makes a gate get switched off.
//
// A reviewer is also dispatched ASYNCHRONOUSLY, so its PostToolUse answer is `async_launched`
// and completion only ever surfaces on SubagentStop. Both halves are tested here, and so is the
// false-positive half: a recorder that fires on anything hands out a silent bypass.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run, uniq } from './helpers.mjs';

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

// A repository with a staged tree and the opted-in proof directory, as a real one has.
function repo() {
  const root = mkdtempSync(join(tmpdir(), 'review-marker-'));
  mkdirSync(join(root, '.council', 'proofs'), { recursive: true });
  git(root, 'init', '-q', '.');
  writeFileSync(join(root, 'main.go'), 'package main\n\nfunc main() {}\n');
  git(root, 'add', '-A');
  return { root, tree: git(root, 'write-tree') };
}

// A subagent transcript. `api-request-blob` entries replay the system prompt and carry a
// message.role, so a reader keyed on role would mistake that replay for the agent's own words.
function transcript(dir, { brief, report, blobOnly = false }) {
  const file = join(dir, `${uniq('agent')}.jsonl`);
  const lines = [];
  if (blobOnly) {
    lines.push({ type: 'api-request-blob', message: { role: 'assistant', content: [{ type: 'text', text: report }] } });
  } else {
    if (brief) lines.push({ type: 'user', message: { role: 'user', content: brief } });
    lines.push({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', name: 'Read', input: {} }] } });
    if (report) lines.push({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: report }] } });
  }
  writeFileSync(file, lines.map(l => JSON.stringify(l)).join('\n') + '\n');
  return file;
}

const stop = (agent_type, agent_transcript_path, cwd) => ({
  hook_event_name: 'SubagentStop', session_id: uniq('s'), prompt_id: uniq('p'),
  cwd, agent_type, agent_id: uniq('a'), agent_transcript_path, stop_hook_active: false,
});

const proofOf = (root) => {
  const file = join(root, '.council', 'proofs', 'review.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
};

describe('review-marker: a dispatched reviewer that finished', () => {
  test('records the reviewer against the tree the brief names', () => {
    const { root, tree } = repo();
    const t = transcript(root, { brief: `Review the repository at ${root}`, report: 'HIGH it panics on zero.' });
    const r = run('review-marker.js', stop('go-reviewer', t, root));
    assert.equal(r.code, 0);
    const proof = proofOf(root);
    assert.ok(proof, 'a completed reviewer left no proof');
    assert.deepEqual(proof.reviewers, ['agent:go-reviewer']);
    assert.ok(proof.trees.includes(tree), 'the proof does not name the staged tree');
    rmSync(root, { recursive: true, force: true });
  });

  test('accumulates perspectives, because depth is a set and not whichever ran last', () => {
    const { root } = repo();
    const session = uniq('s');
    for (const type of ['go-reviewer', 'security-reviewer']) {
      const t = transcript(root, { brief: `Review ${root}`, report: `${type} findings` });
      run('review-marker.js', { ...stop(type, t, root), session_id: session });
    }
    assert.deepEqual(proofOf(root).reviewers, ['agent:go-reviewer', 'agent:security-reviewer']);
    rmSync(root, { recursive: true, force: true });
  });

  test('a synchronous completion on PostToolUse is recorded too', () => {
    const { root } = repo();
    const r = run('review-marker.js', {
      hook_event_name: 'PostToolUse', session_id: uniq('s'), prompt_id: uniq('p'), cwd: root,
      tool_name: 'Agent', tool_input: { subagent_type: 'code-reviewer', prompt: `Review ${root}` },
      tool_response: { status: 'completed', agentType: 'code-reviewer', content: [] },
    });
    assert.equal(r.code, 0);
    assert.deepEqual(proofOf(root).reviewers, ['agent:code-reviewer']);
    rmSync(root, { recursive: true, force: true });
  });
});

describe('review-marker: what must NOT count as a review', () => {
  const refuses = (label, payload, build) => test(label, () => {
    const { root } = repo();
    run('review-marker.js', payload(root, build && build(root)));
    assert.equal(proofOf(root), null, `${label} produced a proof`);
    rmSync(root, { recursive: true, force: true });
  });

  // The launch answer for every backgrounded dispatch: the reviewer has not read anything yet.
  refuses('a dispatch still running (async_launched)', (root) => ({
    hook_event_name: 'PostToolUse', session_id: uniq('s'), cwd: root, tool_name: 'Agent',
    tool_input: { subagent_type: 'go-reviewer', prompt: `Review ${root}` },
    tool_response: { status: 'async_launched', agentType: 'go-reviewer' },
  }));

  // An unknown status must fail CLOSED: the allowlist exists so a new status cannot pass by
  // not being on a denylist of guessed failure names.
  refuses('an unrecognised status', (root) => ({
    hook_event_name: 'PostToolUse', session_id: uniq('s'), cwd: root, tool_name: 'Agent',
    tool_input: { subagent_type: 'go-reviewer', prompt: `Review ${root}` },
    tool_response: { status: 'whatever-comes-next', agentType: 'go-reviewer' },
  }));

  // An agent that reads code is not an agent that reviews it; this is the gap that would make
  // the requirement satisfiable by its own loophole.
  refuses('a non-reviewer agent', (root, t) => stop('general-purpose', t, root),
    (root) => transcript(root, { brief: `Look at ${root}`, report: 'found the file' }));
  refuses('an Explore agent', (root, t) => stop('Explore', t, root),
    (root) => transcript(root, { brief: `Search ${root}`, report: 'three matches' }));

  // Stopping is not reviewing. A subagent that halted before answering proves nothing, and
  // SubagentStop carries no response to tell the two apart — the transcript does.
  refuses('a reviewer that stopped without reporting', (root, t) => stop('go-reviewer', t, root),
    (root) => transcript(root, { brief: `Review ${root}`, report: '' }));

  refuses('a transcript holding only a replayed system prompt',
    (root, t) => stop('go-reviewer', t, root),
    (root) => transcript(root, { report: `you are a reviewer, repo ${root}`, blobOnly: true }));

  refuses('a missing transcript', (root) => stop('go-reviewer', join(root, 'gone.jsonl'), root));
});
