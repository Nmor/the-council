import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Defects these prevent: the dispatcher silently dropping a blocking gate
// (an exit-2 child must block the event), losing additionalContext from a
// matching marker, or routing a tool to scripts whose matcher excludes it —
// any of which would disable live enforcement without an error anywhere.
const script = fileURLToPath(new URL("../dispatch.js", import.meta.url));
const run = (event, payload) =>
  spawnSync("node", [script, event], {
    input: JSON.stringify(payload),
    encoding: "utf8",
    timeout: 60000,
  });

describe("dispatch.js — one spawn per event, behavior preserved", () => {
  test("blocking child blocks: destructive Bash is refused with stderr", () => {
    const r = run("pre", {
      tool_name: "Bash",
      tool_input: { command: "git push --force origin main" },
    });
    // pre-push-gate blocks unauthorized pushes with exit 2
    assert.equal(r.status, 2);
    assert.ok(r.stderr.length > 0, "blocking stderr forwarded");
  });

  test("non-matching tool runs nothing and exits 0", () => {
    const r = run("pre", {
      tool_name: "Read",
      tool_input: { file_path: "/tmp/x" },
    });
    assert.equal(r.status, 0);
    assert.equal(r.stdout, "");
  });

  test("malformed stdin fails open", () => {
    const r = spawnSync("node", [script, "pre"], {
      input: "not json",
      encoding: "utf8",
    });
    assert.equal(r.status, 0);
  });

  test("manifest covers every script the old settings wired", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("../dispatch.js", import.meta.url), "utf8");
    for (const s of [
      "model-ladder-gate.js", "dev-server-gate.js", "pre-push-gate.js",
      "pre-write-governance-sweep.js", "research-gate.js", "intake-gate.js",
      "test-coverage-gate.js", "supersede-proof.js", "deferral-gate.js",
      "payload-gate.js", "destructive-command-gate.js", "one-plan-gate.js",
      "go-discard-mutations.js", "test-coverage-marker.js", "post-edit-format.js",
      "post-edit-console-warn.js", "post-edit-no-discards.js",
      "supersede-proof-marker.js", "docs-sync-marker.js", "research-marker.js",
      "intake-marker.js", "parity-gate.js", "gate-marker.js",
      "post-edit-ux-writing.js", "payload-marker.js", "model-exhaustion-marker.js",
      "pr-created-notice.js", "review-marker.js",
    ]) assert.ok(src.includes(s), s);
  });
});
