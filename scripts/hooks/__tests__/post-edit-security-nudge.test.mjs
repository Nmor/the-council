import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Defects these prevent: the merged inline-security lane going silent (the
// whole point of absorbing security-guidance), firing on clean code or wrong
// file types, or blocking an edit (it must be advisory and fail open).
const script = fileURLToPath(new URL("../post-edit-security-nudge.js", import.meta.url));
const run = (payload) => spawnSync("node", [script], { input: JSON.stringify(payload), encoding: "utf8" });

describe("post-edit-security-nudge.js — the absorbed inline lane", () => {
  test("execSync in a TS file fires the child_process nudge", () => {
    const r = run({ tool_name: "Write", tool_input: { file_path: "/a/b.ts", content: "const x = execSync(cmd);" } });
    assert.equal(r.status, 0);
    assert.match(JSON.parse(r.stdout).hookSpecificOutput.additionalContext, /execFile/);
  });
  test("pickle.loads in a Python file fires; same text in a .go file does not", () => {
    const py = run({ tool_name: "Edit", tool_input: { file_path: "/a/b.py", new_string: "data = pickle.loads(blob)" } });
    assert.match(JSON.parse(py.stdout).hookSpecificOutput.additionalContext, /pickle/i);
    const go = run({ tool_name: "Edit", tool_input: { file_path: "/a/b.xyz", new_string: "data = pickle.loads(blob)" } });
    assert.equal(go.stdout, "");
  });
  test("clean code is silent; malformed stdin fails open", () => {
    const clean = run({ tool_name: "Write", tool_input: { file_path: "/a/b.ts", content: "export const two = 1 + 1;" } });
    assert.equal(clean.stdout, "");
    assert.equal(spawnSync("node", [script], { input: "not json", encoding: "utf8" }).status, 0);
  });
  test("path-only rule: any workflow edit warns about actions injection", () => {
    const r = run({ tool_name: "Edit", tool_input: { file_path: "/repo/.github/workflows/ci.yml", new_string: "jobs: {}" } });
    assert.match(JSON.parse(r.stdout).hookSpecificOutput.additionalContext, /Command Injection/);
  });
  test("exception guidance points at overrides, never inline comments", () => {
    const r = run({ tool_name: "Write", tool_input: { file_path: "/a/b.ts", content: "eval(userInput)" } });
    assert.match(JSON.parse(r.stdout).hookSpecificOutput.additionalContext, /overrides-not-exceptions/);
  });
});
