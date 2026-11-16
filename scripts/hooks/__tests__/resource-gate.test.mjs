import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Defects these prevent: the gate blocking a spawn (it must be advisory and
// fail open on any input), or crashing on malformed stdin — either would turn
// a load advisory into a delegation outage.
const script = fileURLToPath(new URL("../resource-gate.js", import.meta.url));
describe("resource-gate.js — advisory, never blocking", () => {
  test("exits 0 on a normal payload whatever the load", () => {
    const r = spawnSync("node", [script], {
      input: JSON.stringify({ tool_name: "Agent", tool_input: {} }),
      encoding: "utf8", timeout: 10000,
    });
    assert.equal(r.status, 0);
    if (r.stdout) {
      const out = JSON.parse(r.stdout); // any output must be valid context JSON
      assert.match(out.hookSpecificOutput.additionalContext, /resource-gate/);
    }
  });
  test("exits 0 on malformed stdin", () => {
    assert.equal(spawnSync("node", [script], { input: "not json", encoding: "utf8" }).status, 0);
  });
});
