// Size budget: 4 KB. Check: wc -c; gate: token-budget.mjs --check.
// Refusal tests for commit-gate.js's independent-review rule (done-criteria.md).
//
// The rule landed without one: replacing it with `if (false)` left every hook test passing.
// Each test below fails if its branch stops refusing, and checks the gate's own reason.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { run, uniq, cleanup, verificationProof, reviewProof } from './helpers.mjs';
describe('commit-gate.js — a commit needs an independent review of what it commits', () => {
  const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  const edit = (sid, turn) => run('test-coverage-gate.js', { session_id: sid, prompt_id: turn, tool_name: 'Write',
    tool_input: { file_path: '/x/a.go', content: 'package main' } });
  const verified = (sid, turn) => {
    verificationProof(sid, turn, undefined, {}, true);
    run('gate-marker.js', { session_id: sid, prompt_id: turn, tool_name: 'Bash',
      tool_input: { command: 'go test ./...' }, tool_response: { exit_code: 0 } });
  };
  const commit = (sid, turn) => run('commit-gate.js', { session_id: sid, prompt_id: turn, tool_name: 'Bash',
    tool_input: { command: 'git commit -m x' } });
  const clean = (sid) => cleanup(`claude-council-coverage-${sid}`, `claude-council-lastedit-${sid}`,
    `claude-council-gate-${sid}`, `claude-council-srcedits-${sid}`, `claude-council-review-${sid}`);

  test('refuses a commit no review read', () => {
    const sid = uniq('sid'); edit(sid, 't1'); verified(sid, 't1');
    const r = commit(sid, 't1');
    assert.equal(r.code, 2);
    assert.match(r.stderr, /no independent code review ran against this source/);
    clean(sid);
  });

  test('refuses a review from an earlier turn', () => {
    const sid = uniq('sid'); edit(sid, 't1'); reviewProof(sid, 't1'); verified(sid, 't2');
    const r = commit(sid, 't2');
    assert.equal(r.code, 2);
    assert.match(r.stderr, /the last code review ran in an EARLIER TURN/);
    clean(sid);
  });

  test('refuses a review the source has changed since', () => {
    const sid = uniq('sid'); edit(sid, 't1'); reviewProof(sid, 't1');
    sleep(20); edit(sid, 't1'); verified(sid, 't1');
    const r = commit(sid, 't1');
    assert.equal(r.code, 2);
    assert.match(r.stderr, /source changed AFTER the code review ran/);
    clean(sid);
  });

  test('refuses a review from a single perspective', () => {
    const sid = uniq('sid'); edit(sid, 't1'); reviewProof(sid, 't1', undefined, {}, ['go-reviewer']); verified(sid, 't1');
    const r = commit(sid, 't1');
    assert.equal(r.code, 2);
    assert.match(r.stderr, /only 1 perspective\(s\) reviewed this/);
    clean(sid);
  });
});
