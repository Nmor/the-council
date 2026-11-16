import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Defect this prevents: the SessionStart hook emitting malformed JSON or the
// wrong event shape, which Claude Code would silently discard — leaving plugin
// injections un-demoted without anyone noticing.
test("debate-frame emits valid SessionStart additionalContext", () => {
  const script = fileURLToPath(new URL("../debate-frame.js", import.meta.url));
  const out = JSON.parse(
    execFileSync("node", [script], { input: "{}" }).toString(),
  );
  assert.equal(out.hookSpecificOutput.hookEventName, "SessionStart");
  assert.match(out.hookSpecificOutput.additionalContext, /DEBATE POSITIONS/);
  assert.match(out.hookSpecificOutput.additionalContext, /best-idea-wins/);
});
