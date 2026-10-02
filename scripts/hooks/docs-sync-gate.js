#!/usr/bin/env node
// Size budget: 8 KB. Check: wc -c; gate: token-budget.mjs --check.
// Stop hook.
//
// A turn that changed code does not end with the plan still describing the world before it.
// Enforces plan-execution-progress.md rule 8 — "the plan file stays current; a completed task
// is marked and annotated" — at the one moment that is both a task boundary and able to block:
// the end of the turn.
//
// WHY STOP, AND WHY THIS REPLACED WHAT WAS HERE. This hook used to run on PostToolUse for
// TodoWrite and claimed to "block by default". It never blocked anything and, in some
// harnesses, never ran:
//   - PostToolUse runs AFTER the tool call; exit 2 there only feeds text back, it cannot
//     prevent or undo anything (code.claude.com/docs/en/hooks, read 2026-09-21).
//   - Not every harness offers TodoWrite. A session without it never triggered this gate at
//     all, so "plan updated as tasks complete" was enforced by nothing.
//   - Its evidence came from an Edit/Write marker, blind to every change made through Bash.
// Owner directive (2026-09-21): "plan update as tasks are completed and doc updates before
// code changes are committed or pushed". Docs are enforced where they belong, at commit and
// push (commit-gate.js, pre-push-gate.js); this hook owns the plan.
//
// Git mtimes identify session work only when the transcript supplies a start time.
// Without that baseline, or outside Git, Edit/Write markers supply the evidence.
//
// PER PROJECT, AND MEMORY TOO (owner, 2026-09-21: "project memory was stale"; "I am running
// different projects"). The plan is the one this project's memory index names on an
// `Active plan:` line (lib/project-context.js), never the newest file in the shared
// ~/.claude/plans — that let one project's plan edit satisfy another project's gate. The same
// stop also refuses a project memory that lib/memory-lint.js proves stale or unloadable, and
// progress copied into a memory file this session wrote.
//
// STAYS OUT OF THE WAY. Only files changed since this session started count, so the owner's
// own uncommitted work never trips it. It blocks at most once per stop: `stop_hook_active`
// means a Stop hook already forced this continuation. A project that runs without a plan says
// so once, as `Active plan: none`.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const gs = require("./lib/git-state.js");
const pc = require("./lib/project-context.js");
const { lintMemory, format } = require("./lib/memory-lint.js");

// Fail CLOSED on a value this hook does not recognise. The TodoWrite version treated anything
// but "block" as a warning, so a typo such as CLAUDE_DOCS_SYNC=true quietly disabled the block
// — its own tests recorded that as a defect. Only the two documented escapes loosen it.
const RAW = (process.env.CLAUDE_DOCS_SYNC || "block").toLowerCase();
const MODE = RAW === "off" || RAW === "warn" ? RAW : "block";

const markerTime = (sid, kind) => {
  try {
    return (
      Number(
        fs.readFileSync(
          path.join(os.tmpdir(), `claude-docs-sync-${kind}-${sid}`),
          "utf8",
        ),
      ) || 0
    );
  } catch {
    return 0;
  }
};

// The session began when its transcript was created. Anything older is not this session's.
const sessionStart = (transcript) => {
  try {
    const st = fs.statSync(transcript);
    if (!st.isFile()) return 0;
    return st.birthtimeMs || st.ctimeMs || 0;
  } catch {
    return 0;
  }
};

function codeEvidence(cwd, since, sid) {
  const root = gs.repoRoot(cwd);
  if (!root || !since)
    return { changed: [], codeTime: sid ? markerTime(sid, "code") : 0 };
  const changed = gs.dirtyFiles(root)
    .filter((f) => ["code", "test"].includes(gs.classify(f)))
    .filter((f) => gs.newestMtime(root, [f]) > since);
  return { changed, codeTime: gs.newestMtime(root, changed) };
}

function planReasons(cwd, codeTime, changed) {
  if (!codeTime) return [];
  const plan = pc.activePlan(cwd);
  if (plan.state === "unset")
    return [
      `This project names no active plan. Plans for several projects share ~/.claude/plans, so ` +
        `the gate never guesses: add "Active plan: <path to this work's plan>" to ${plan.index} ` +
        `(or "Active plan: none" if this project runs without one).`,
    ];
  if (plan.state === "missing")
    return [`The active plan ${plan.path} no longer exists. Point ${plan.index} at the current plan.`];
  if (plan.state !== "set" || plan.mtime >= codeTime) return [];
  const extra = changed.length > 5 ? `, +${changed.length - 5} more` : "";
  const list = changed.slice(0, 5).join(", ") + extra;
  const files = list ? ` (${list})` : "";
  return [
    `Code changed this session after the plan was last updated${files}. ` +
      `Update ${plan.path}: tick the task(s) just finished with a one-line outcome (commit or ` +
      `file, gate result), and add any work this turn discovered as new tasks. Per ` +
      `plan-execution-progress.md rule 8 the plan is the source of truth; it survives compaction.`,
  ];
}

function memoryTouched(memDir, since, sid, wroteNow) {
  // Without a persisted transcript, mtimes cannot identify this session's writes.
  if (!since) return Boolean(sid && markerTime(sid, "memory"));
  try {
    return fs.readdirSync(memDir).some((f) => f.endsWith(".md") && wroteNow(f));
  } catch {
    return false;
  }
}

function memoryReasons(cwd, since, sid, codeTime) {
  // Progress patterns need file attribution; proven broken references need only work evidence.
  const memDir = pc.memoryDir(cwd);
  const wroteNow = (f) => since > 0 && gs.newestMtime(memDir, [f]) > since;
  if (!codeTime && !memoryTouched(memDir, since, sid, wroteNow)) return [];
  const found = lintMemory(memDir).filter((f) => f.proven || wroteNow(f.file));
  if (!found.length) return [];
  const extra = found.length > 8 ? `\n  +${found.length - 8} more: node ~/.claude/scripts/memory-lint.mjs` : "";
  return [
    `This project's memory is stale or unloadable (${found.length}). Correct each entry, or ` +
      `delete it if the plan now carries it:\n` +
      found.slice(0, 8).map((f) => `  ${format(memDir, f)}`).join("\n") + extra,
  ];
}

let data = "";
process.stdin.on("data", (c) => (data += c));
process.stdin.on("end", () => {
  if (MODE === "off") process.exit(0);
  let input = {};
  try {
    const parsed = JSON.parse(data || "{}");
    // `null` and arrays parse cleanly and then have no fields; reading one crashed this hook.
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      input = parsed;
  } catch {
    process.exit(0);
  }
  if (input.stop_hook_active) process.exit(0); // already forced one continuation this stop

  // Claude Code sends `cwd` on every Stop. Without it this hook cannot know which project
  // it is judging, and guessing from its own working directory blocked turns (and failed
  // the degrade-safely tests) whenever it happened to run inside a repo with changes.
  if (!input.cwd) process.exit(0);
  const cwd = input.cwd;
  const since = sessionStart(input.transcript_path || "");
  const { changed, codeTime } = codeEvidence(cwd, since, input.session_id);
  const reasons = [
    ...planReasons(cwd, codeTime, changed),
    ...memoryReasons(cwd, since, input.session_id, codeTime),
  ];
  if (!reasons.length) process.exit(0);

  const msg =
    reasons.map((r) => `[docs-sync-gate] ${r}`).join("\n") +
    `\n[docs-sync-gate] Modes: CLAUDE_DOCS_SYNC=block (default) | warn | off\n`;
  if (MODE === "block") {
    process.stderr.write(msg);
    process.exit(2);
  }
  // Warn mode must not reopen the turn, and stderr on exit 0 is never shown, so it goes to
  // the user as a systemMessage.
  process.stdout.write(JSON.stringify({ systemMessage: msg.trimEnd() }));
  process.exit(0);
});
