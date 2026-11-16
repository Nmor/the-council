import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Defects these prevent: the intake hook silently losing its domain routing
// (domain conversations would again never reach the model-invisible bench),
// spamming the hint on engineering prompts, or breaking its never-block
// contract on acks and malformed stdin.
const script = fileURLToPath(new URL("../../../hooks/improve-prompt.py", import.meta.url));
const run = (payload) =>
  spawnSync("python3", [script], { input: payload, encoding: "utf8" });

describe("improve-prompt.py — domain-aware intake", () => {
  test("business prompt surfaces the domain bench", () => {
    const r = run(JSON.stringify({ prompt: "help me with pricing tiers and churn for my startup" }));
    assert.equal(r.status, 0);
    const ctx = JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
    assert.match(ctx, /Domain bench/);
    assert.match(ctx, /council-hormozi|entrepreneur/);
  });
  test("engineering prompt gets no domain hint", () => {
    const r = run(JSON.stringify({ prompt: "refactor the auth middleware and fix the failing test" }));
    const ctx = JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
    assert.ok(!ctx.includes("Domain bench"));
  });
  test("agent-relay messages with domain words stay silent (observed false positive 2026-11-15)", () => {
    const r = run(JSON.stringify({ prompt: '<agent-message from="x">report about pricing tiers</agent-message>' }));
    assert.equal(r.stdout, "");
  });
  test("coding prompts with embedded domain substrings stay clean (review M7)", () => {
    for (const p of ["add a cache layer for sessions", "the hook keeps firing twice", "database indexing is slow"]) {
      const r = run(JSON.stringify({ prompt: p }));
      const ctx = JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
      assert.ok(!ctx.includes("Domain bench"), p);
    }
  });
  test("ack stays silent and malformed stdin never blocks", () => {
    assert.equal(run(JSON.stringify({ prompt: "ok" })).stdout, "");
    assert.equal(run("not json").status, 0);
  });
});
