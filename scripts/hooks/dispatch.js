#!/usr/bin/env node
// Council hook dispatcher: Claude Code spawns ONE node per PreToolUse/PostToolUse
// event; this routes to the gate/marker scripts whose tool matcher applies and
// runs them serially with the buffered stdin. Replaces ~9-10 separate harness
// spawns per file edit (audit 2026-11-15 #4). The per-script behavior and the
// scripts themselves are unchanged — the suite still tests each directly.
//
// Merge contract: a child exiting 2 blocks the event (its stderr forwarded,
// exit 2). A child emitting JSON with a decision/permission field is forwarded
// whole and dispatch stops. additionalContext strings concatenate. Child
// crashes (other nonzero exits) fail open per-script, like the harness did.
"use strict";
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const EVENT = process.argv[2]; // 'pre' | 'post'
// exported for tests (dispatch.test.mjs asserts routing, not substrings)
module.exports = { MANIFEST: null };
const MANIFEST = {
  pre: [
    ["resource-gate.js", /^(Agent|Task)$/, 5],
    ["model-ladder-gate.js", /^(Agent|Task)$/, 20],
    ["dev-server-gate.js", /^Bash$/, 20],
    ["pre-push-gate.js", /^Bash$/, 20],
    ["pre-write-governance-sweep.js", /^Write$/, 20],
    ["research-gate.js", /^(Edit|Write)$/, 20],
    ["intake-gate.js", /^(Edit|Write|MultiEdit)$/, 20],
    ["test-coverage-gate.js", /^(Edit|Write|MultiEdit)$/, 20],
    ["supersede-proof.js", /^(Edit|Write|MultiEdit)$/, 20],
    ["deferral-gate.js", /^(Edit|Write|MultiEdit)$/, 10],
    ["payload-gate.js", /^(Edit|Write|MultiEdit)$/, 10],
    ["destructive-command-gate.js", /^Bash$/, 10],
    ["one-plan-gate.js", /^(Bash|Edit|Write|MultiEdit)$/, 10],
    [
      "go-discard-mutations.js",
      /^(Bash|Edit|Write|MultiEdit)$/,
      20,
      [
        "--state-dir",
        path.join(process.env.HOME, ".claude/runtime/go-mutations"),
      ],
    ],
  ],
  post: [
    ["test-coverage-marker.js", /^Bash$/, 45],
    ["post-edit-format.js", /^(Edit|Write|MultiEdit)$/, 45],
    ["post-edit-console-warn.js", /^(Edit|Write|MultiEdit)$/, 45],
    ["post-edit-typecheck.js", /^(Edit|Write|MultiEdit)$/, 45],
    ["post-edit-security-nudge.js", /^(Edit|Write|MultiEdit)$/, 10],
    ["post-edit-no-discards.js", /^(Edit|Write)$/, 45],
    ["supersede-proof-marker.js", /^(Edit|Write|MultiEdit)$/, 45],
    ["docs-sync-marker.js", /^(Edit|Write|MultiEdit)$/, 45],
    ["research-marker.js", /^(WebSearch|WebFetch)$/, 45],
    ["intake-marker.js", /^TodoWrite$/, 45],
    ["parity-gate.js", /^(Edit|Write|MultiEdit)$/, 45],
    ["gate-marker.js", /^Bash$/, 45],
    ["post-edit-ux-writing.js", /^(Edit|Write)$/, 45],
    ["payload-marker.js", /^Bash$/, 10],
    ["model-exhaustion-marker.js", /^(Agent|Task)$/, 5],
    ["pr-created-notice.js", /^Bash$/, 45],
    [
      "go-discard-mutations.js",
      /^(Bash|Edit|Write|MultiEdit)$/,
      20,
      [
        "--state-dir",
        path.join(process.env.HOME, ".claude/runtime/go-mutations"),
      ],
    ],
    ["review-marker.js", /^(Agent|Task|Skill)$/, 10],
  ],
};
module.exports.MANIFEST = MANIFEST;
if (require.main !== module) { /* test import */ } else {
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => {
  input += c;
});
process.stdin.on("end", () => {
  let tool = "";
  try {
    tool = JSON.parse(input).tool_name || "";
  } catch {
    /* fail open */
  }
  const contexts = [];
  const messages = [];
  // M1 2026-11-15: children run serially; a dispatch-level deadline keeps the sum
  // under the harness's outer timeout (60s pre / 90s post). A child's budget is
  // capped by remaining time; skipped children are reported, never silently lost.
  const DEADLINE_MS = (EVENT === "pre" ? 55 : 85) * 1000;
  const started = Date.now();
  for (const [script, matcher, timeout, extra] of MANIFEST[EVENT] || []) {
    if (!matcher.test(tool)) continue;
    const remaining = DEADLINE_MS - (Date.now() - started);
    if (remaining < 2000) {
      messages.push(`[dispatch] ${script} skipped: deadline reached`);
      continue;
    }
    const r = spawnSync(
      "node",
      [path.join(__dirname, script), ...(extra || [])],
      {
        input,
        encoding: "utf8",
        timeout: Math.min(timeout * 1000, remaining),
      },
    );
    // M2: fail-open stays, silence does not
    if (r.error || r.signal) {
      const reason = r.error ? r.error.code || r.error.message : `signal ${r.signal}`;
      messages.push(`[dispatch] ${script} failed open: ${reason}`);
      process.stderr.write(`[dispatch] ${script} failed open: ${reason}\n`);
      continue;
    }
    if (r.status !== 0 && r.status !== 2) {
      messages.push(`[dispatch] ${script} failed open: exit ${r.status}`);
      if (r.stderr) process.stderr.write(r.stderr.slice(0, 2000));
      continue;
    }
    if (r.status === 2) {
      // blocking: forward and stop
      if (r.stderr) process.stderr.write(r.stderr);
      process.exit(2);
    }
    if (!r.stdout) continue;
    try {
      const out = JSON.parse(r.stdout);
      if (
        out.decision ||
        out.continue === false ||
        (out.hookSpecificOutput &&
          (out.hookSpecificOutput.permissionDecision ||
            out.hookSpecificOutput.updatedInput))
      ) {
        process.stdout.write(r.stdout); // control output: forward whole, stop
        process.exit(r.status || 0);
      }
      const ctx =
        out.hookSpecificOutput && out.hookSpecificOutput.additionalContext;
      if (ctx) contexts.push(ctx);
      if (out.systemMessage) messages.push(out.systemMessage);
    } catch {
      /* non-JSON stdout: ignore, as the harness would */
    }
  }
  if (contexts.length || messages.length) {
    const out = {};
    if (contexts.length)
      out.hookSpecificOutput = {
        hookEventName: EVENT === "pre" ? "PreToolUse" : "PostToolUse",
        additionalContext: contexts.join("\n\n"),
      };
    if (messages.length) out.systemMessage = messages.join(" | ");
    process.stdout.write(JSON.stringify(out));
  }
  process.exit(0);
});
process.stdin.on("error", () => process.exit(0));
}
