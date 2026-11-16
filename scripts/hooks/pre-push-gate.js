#!/usr/bin/env node
// Size budget: 11 KB. Check: wc -c; gate: token-budget.mjs --check.
// pre-push-gate.js
//
// PreToolUse Bash hook. Enforces
// ~/.claude/rules/common/plan-completion-before-push.md:
//
// (a) No push reaches a remote unless the operator has set
//     CLAUDE_PUSH_AUTHORIZED=yes in the session for THIS push only.
// (b) No `git commit` lands a `Co-Authored-By: Claude` (or any
//     Claude / Anthropic AI attribution) trailer, nor the
//     "🤖 Generated with Claude Code" marketing footer. Both
//     overrule the default Claude-Code system-prompt templates
//     per user directive 2026-06-08 ("no and never are to global
//     rules and hooks") — see
//     ~/.claude/rules/common/plan-completion-before-push.md §11.
//
// The hook PASSES every other Bash invocation through unchanged
// (stdout) and EXITS 2 (blocks) on a violating `git push` /
// `git commit`.
//
// Bypass policy:
//   CLAUDE_PUSH_AUTHORIZED=yes git push origin main
//
// The env var is per-process so it does NOT leak across shells.
// There is intentionally NO bypass for the Co-Authored-By gate
// — the user-stated rule is "never".

"use strict";

// One home for "judge what the command RUNS, not text it carries" (lib/command-scan.js). This
// hook used to keep a private copy with a shorter interpreter list, so a heredoc piped to
// psql was judged differently here than in every other gate.
const { commandInvocations, gitOperation } = require("./lib/command-scan.js");
const { advise } = require("./lib/advise.js");

// Log-line prefix used by every stderr message this hook emits.
// Lifted to a const so a future prefix change is one edit, not a sweep.
const LOG_PREFIX = "[pre-push-gate] ";

// Exact outgoing-commit docs, review and test evidence are checked by the native
// committed-push-gate.js, including pushes of refs other than HEAD.
function pushArguments(args) {
  const options = [];
  const positional = [];
  let terminated = false;
  let repository = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args.at(i);
    if (arg === "--") { terminated = true; continue; }
    if (terminated || !arg.startsWith("-")) { positional.push(arg); continue; }
    if (/^--repo(?:=|$)/.test(arg)) repository = true;
    if (isShortPushOption(arg)) {
      const index = arg.indexOf("o");
      options.push(arg.slice(0, index));
      if (index === arg.length - 1) i++;
      continue;
    }
    options.push(arg);
    if (/^(?:-o|--push-option|--receive-pack|--exec|--repo|--recurse-submodules)$/.test(arg)) i++;
  }
  return { options, refs: repository ? positional : positional.slice(1) };
}

function isShortPushOption(arg) {
  return arg.startsWith("-") && !arg.startsWith("--") && arg.includes("o");
}

function protectedRef(ref) {
  const destination = ref.slice(ref.lastIndexOf(":") + 1).replace(/^\+/, "").replace(/^refs\/heads\//, "");
  if (!destination) return true; // Matching refspecs may include a protected branch.
  const protectedNames = ["main", "master", "production", "trunk"];
  if (!destination.includes("*")) return protectedNames.includes(destination);
  const [prefix, suffix] = destination.split("*");
  return protectedNames.some((name) => name.startsWith(prefix) && name.endsWith(suffix || ""));
}

function shortFlag(arg, flag) {
  return /^-[A-Za-z]+$/.test(arg) && arg.includes(flag);
}

function pushFlags(args) {
  const { options, refs } = pushArguments(args);
  const force = options.some((arg) => arg === "--force" || arg.startsWith("--force-with-lease") || shortFlag(arg, "f"));
  let dryRun = false;
  for (const option of options) {
    if (option === "--no-dry-run") dryRun = false;
    else if (option === "--dry-run" || shortFlag(option, "n")) dryRun = true;
  }
  return {
    inspect: dryRun || options.some((arg) => arg === "--help" || arg === "-h"),
    protectedForce: (force && (refs.some(protectedRef) || options.includes("--all") ||
      (!refs.length && !options.includes("--tags")))) ||
      options.includes("--mirror") || refs.some((ref) => ref.startsWith("+") && protectedRef(ref)),
  };
}

const stdin = process.stdin;
let buf = "";

stdin.setEncoding("utf8");
stdin.on("data", (chunk) => {
  buf += chunk;
});
stdin.on("end", () => {
  let cmd = "";
  let cwd = process.cwd();
  try {
    const payload = JSON.parse(buf);
    cmd = payload.tool_input?.command ?? "";
    cwd = payload.cwd || cwd;
  } catch {
    // If we can't parse the payload, pass through — the harness
    // owns the protocol and we are not the parser of record.
    return;
  }

  const calls = commandInvocations(cmd);
  const commits = calls.filter((call) => gitOperation(call.argv).operation === "commit");
  for (const call of commits) {
    const { args } = gitOperation(call.argv);
    const scan = [...args, call.input || ""].join(" ");
    const coAuthor =
      /Co-?Authored-?By:\s*(Claude|Anthropic|noreply@anthropic\.com)/i.test(
        scan,
      );
    const generatedFooter = /Generated with \[?Claude Code\]?|🤖.*Claude/i.test(
      scan,
    );
    if (coAuthor || generatedFooter) {
      process.stderr.write(
        `${LOG_PREFIX}BLOCKED: commit message carries a Claude/Anthropic AI-attribution trailer.\n` +
          `${LOG_PREFIX}Per ~/.claude/rules/common/plan-completion-before-push.md §11 +\n` +
          `${LOG_PREFIX}user directive 2026-06-08, never add:\n` +
          `${LOG_PREFIX}  Co-Authored-By: Claude <noreply@anthropic.com>\n` +
          `${LOG_PREFIX}  🤖 Generated with [Claude Code](https://claude.com/claude-code)\n` +
          `${LOG_PREFIX}or any equivalent. Strip the trailer and re-run.\n` +
          `${LOG_PREFIX}There is no bypass — the rule is global and absolute.\n`,
      );
      process.exit(2);
    }
  }
  const pushes = calls.filter((call) => gitOperation(call.argv).operation === "push");
  let authorisedPush = false;
  for (const call of pushes) {
    const { args } = gitOperation(call.argv);

    // Inline authorization belongs to this invocation, including after an earlier commit.
    const authorised = (call.assignments.CLAUDE_PUSH_AUTHORIZED ?? process.env.CLAUDE_PUSH_AUTHORIZED) === "yes";

    // Allow `git push --help` and dry-run inspection regardless.
    const flags = pushFlags(args);
    if (flags.inspect) {
      continue;
    }

    // Force-push to default branches: refuse outright regardless of authorisation.
    // The agent must never force-push to protected refs without explicit
    // human override at the shell.
    if (flags.protectedForce) {
      process.stderr.write(
        `${LOG_PREFIX}BLOCKED: force-push to a protected branch.\n` +
          `${LOG_PREFIX}Per ~/.claude/rules/common/plan-completion-before-push.md +\n` +
          `${LOG_PREFIX}global action-care rules, force-push to main/master/production/trunk\n` +
          `${LOG_PREFIX}requires running the command directly in your shell — never via the agent.\n`,
      );
      process.exit(2);
    }

    if (!authorised) {
      process.stderr.write(
        `${LOG_PREFIX}BLOCKED: \`git push\` requires explicit authorisation.\n` +
          `${LOG_PREFIX}Per ~/.claude/rules/common/plan-completion-before-push.md,\n` +
          `${LOG_PREFIX}no push reaches a remote until the operator confirms the plan is\n` +
          `${LOG_PREFIX}complete (or this is an explicitly-named bug-fix override).\n` +
          `${LOG_PREFIX}\n` +
          `${LOG_PREFIX}AND every changed symbol/flag/env/config must be 100% CONFIRMED\n` +
          `${LOG_PREFIX}and WIRED — reaching a live consumer on the live path, verified\n` +
          `${LOG_PREFIX}this turn, NOT assumed. No inert code/config (e.g. an env the app\n` +
          `${LOG_PREFIX}never reads). Per ~/.claude/rules/common/wiring-and-usage-review.md.\n` +
          `${LOG_PREFIX}\n` +
          `${LOG_PREFIX}To proceed for THIS push only:\n` +
          `${LOG_PREFIX}  CLAUDE_PUSH_AUTHORIZED=yes <your-push-command>\n` +
          `${LOG_PREFIX}\n` +
          `${LOG_PREFIX}Attempted command:\n` +
          `${LOG_PREFIX}  ${cmd}\n`,
      );
      process.exit(2);
    }

    authorisedPush = true;
  }
  // Emit one protocol response even when the command contains several authorized pushes.
  if (authorisedPush)
  advise(
    null,
    `${LOG_PREFIX}NOTE: authorising this push asserts every changed symbol/flag/env/\n` +
      `${LOG_PREFIX}config is 100% CONFIRMED and WIRED (live-path verified, no inert\n` +
      `${LOG_PREFIX}code/config). If any is unconfirmed/unwired, abort and verify first.`,
  );
});

stdin.on("error", (err) => {
  process.stderr.write(`${LOG_PREFIX}stdin error: ${err.message}\n`);
  process.exit(0); // do not block on hook plumbing errors
});
