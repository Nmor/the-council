// Size budget: 16 KB. Check: wc -c; gate: token-budget.mjs --check.
// The plan-and-docs discipline, end to end: "plan update as tasks are completed and doc updates
// before code changes are committed or pushed" (owner directive, 2026-09-21).
//
//   docs-sync-gate.js         (Stop)            — in docs-sync-gate.test.mjs
//   committed-push-gate.js    (native pre-push) — no commit reaches a remote without docs
//                                                 or a `Docs:` line, plus owner authorization
//                                                 (commit-gate.js was retired by the 2026-11-09
//                                                 commit-then-review policy; enforcement moved
//                                                 to the native hook)
//   pre-push-gate.js          (PreToolUse)      — tool-level push authorization
//
// Everything runs against real throwaway git repositories and a throwaway HOME, so the hooks
// ask real git the questions they ask in use, and no test reads this machine's own plans.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "./helpers.mjs";
import { ISOLATED, git, world, edit } from "./plan-world.mjs";

// ──────────────────────────────────────────────────────────────────────────
describe("committed-push-gate.js — no commit reaches a remote without docs or a Docs: line", () => {
  /** A repo whose origin already has the base commit, so only new commits are unpushed. */
  function pushable() {
    const w = world();
    const bare = join(w.base, "origin.git");
    execFileSync("git", ["init", "-q", "--bare", bare], {
      env: { ...process.env, ...ISOLATED },
    });
    git(w.repo, "remote", "add", "origin", bare);
    git(w.repo, "push", "-q", "origin", "HEAD:main");
    git(w.repo, "fetch", "-q", "origin");
    return { w, bare };
  }

  // Drive the native gate exactly as git-template/hooks/pre-push does:
  // ref-update lines on stdin, remote name and URL as argv.
  const gateScript = fileURLToPath(
    new URL("../committed-push-gate.js", import.meta.url),
  );

  // Commit-bound proofs the native gate demands (review + verification), written
  // the way council-record-proof.sh records them, so docs is the only open question.
  const plantProofs = (w) => {
    const commit = git(w.repo, "rev-parse", "HEAD").trim();
    const tree = git(w.repo, "rev-parse", "HEAD^{tree}").trim();
    const dir = join(w.repo, ".council", "proofs", "commits", commit);
    mkdirSync(dir, { recursive: true });
    const base = { commit, tree, at: Date.now() };
    writeFileSync(
      join(dir, "review.json"),
      JSON.stringify({
        ...base,
        verdict: "approved",
        findings_remaining: 0,
        reviewers: ["reviewer-a", "reviewer-b"],
      }),
    );
    writeFileSync(
      join(dir, "gate.json"),
      JSON.stringify({
        ...base,
        exit_code: 0,
        coverage: 95,
        checks: [{ command: "go test ./...", exit_code: 0 }],
      }),
    );
  };
  const push = ({ w, bare }, env = { CLAUDE_PUSH_AUTHORIZED: "yes" }) => {
    const local = git(w.repo, "rev-parse", "HEAD").trim();
    const remote = git(w.repo, "rev-parse", "origin/main").trim();
    const r = spawnSync("node", [gateScript, "origin", bare], {
      cwd: w.repo,
      input: `refs/heads/main ${local} refs/heads/main ${remote}\n`,
      env: { ...process.env, ...ISOLATED, ...w.env, ...env },
      encoding: "utf8",
    });
    return { code: r.status, stderr: r.stderr };
  };

  test("refuses an authorised push carrying an undocumented code commit", () => {
    const p = pushable();
    edit(p.w, "service.go");
    git(p.w.repo, "add", "-A");
    git(p.w.repo, "commit", "-qm", "feat: undocumented");
    plantProofs(p.w);
    const r = push(p);
    assert.equal(r.code, 1);
    assert.match(r.stderr, /documentation|Docs: decision/);
  });

  test("accepts a commit that carries its docs", () => {
    const p = pushable();
    edit(p.w, "service.go");
    edit(p.w, "CHANGELOG.md", "# c\n");
    git(p.w.repo, "add", "-A");
    git(p.w.repo, "commit", "-qm", "feat: documented");
    plantProofs(p.w);
    assert.equal(push(p).code, 0);
  });

  test("accepts a commit whose message records a Docs: decision", () => {
    const p = pushable();
    edit(p.w, "service.go");
    git(p.w.repo, "add", "-A");
    git(
      p.w.repo,
      "commit",
      "-qm",
      "refactor: x",
      "-m",
      "Docs: none — internal refactor",
    );
    plantProofs(p.w);
    assert.equal(push(p).code, 0);
  });

  test("does not re-judge commits the remote already has", () => {
    const p = pushable(); // the base commit is on origin and has no docs question to answer
    assert.equal(push(p).code, 0);
  });

  test("the native gate refuses a push with no owner authorization", () => {
    const p = pushable();
    const r = push(p, {});
    assert.equal(r.code, 1);
    assert.match(r.stderr, /authorization is required/);
  });
});

// ──────────────────────────────────────────────────────────────────────────
describe("pre-push-gate.js — tool-level push authorization", () => {
  test("still requires authorisation at the tool boundary", () => {
    const w = world();
    const r = run(
      "pre-push-gate.js",
      {
        cwd: w.repo,
        tool_name: "Bash",
        tool_input: { command: "git push origin HEAD:main" },
      },
      w.env,
    );
    assert.equal(r.code, 2);
    assert.match(r.stderr, /requires explicit authorisation/);
  });
});
