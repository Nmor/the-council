#!/usr/bin/env node
// Size budget: 9 KB. Check: wc -c; gate: token-budget.mjs --check.
// PreToolUse hook (matcher: Bash).
//
// Blocks commands that destroy data irreversibly. This install had NO such gate: nothing
// stood between an agent and `rm -rf /`, `DROP DATABASE`, a force-push over main, or
// `chmod 777` on a key. The Council's own rules treat destructive operations as a Division 11
// VETO and require explicit confirmation — that was prose enforced by nothing.
//
// WHY THIS ONE CAN BLOCK HARD. Most gates here are advisory, because a heuristic that fires
// on legitimate work gets switched off. This set is different: the patterns are rare and
// unambiguous in ordinary development. Nobody types `rm -rf /` by accident, and the cost
// asymmetry is total — a false positive costs one rephrase, a false negative costs the disk.
//
// WHAT IT DOES NOT DO. It does not try to be a sandbox or a general safety layer; Claude Code
// has its own permission system and auto-mode classifier. It is the deterministic floor under
// those: it cannot be talked round, and it travels with the install.
//
// Writing ABOUT a destructive command is not running one. A heredoc redirected to a file is
// documentation; one piped to a shell or a database client is execution. See lib/command-scan.
//
// CLAUDE_DESTRUCTIVE_GATE=warn to downgrade, =off to disable. Neither is recommended.
"use strict";

const { commandInvocations, gitOperation } = require("./lib/command-scan.js");

const ROOT_TARGETS = new Set(["/", "/*", "~", "~/", "~/*", "$HOME", "$HOME/", "${HOME}", "${HOME}/"]);
const SYSTEM_TARGETS = new Set(["*", "/etc", "/usr", "/var", "/bin", "/sbin", "/lib", "/boot", "/sys", "/proc", "/dev", "/opt", "/home", "/Users"]);
const SQL_RULES = [
  [/\bDROP\s+(?:DATABASE|SCHEMA)\b/i, "dropping a database or schema"],
  [/\bDROP\s+TABLE\b/i, "dropping a table"],
  [/\bTRUNCATE\s+TABLE\b/i, "truncating a table"],
];
const COMMAND_RULES = [
  [(name, args) => name === "chmod" && args.includes("777"), "chmod 777 — world-writable"],
  [(name) => name === "mkfs" || name.startsWith("mkfs.") || name === "fdisk" || name === "parted", "formatting or repartitioning a disk"],
  [(name, args) => name === "dd" && args.some((arg) => arg.startsWith("of=/dev/")), "dd writing directly to a device"],
  [(name) => name === "shred", "shred — unrecoverable overwrite"],
  [(name, args) => name === "aws" && args[0] === "s3" && args[1] === "rb" && args.includes("--force"), "deleting a populated S3 bucket"],
  [(name, args) => name === "kubectl" && args[0] === "delete" && /^(?:ns|namespace)$/.test(args[1]), "deleting a Kubernetes namespace"],
];

function removalReason(args) {
  const flags = args.filter((arg) => arg.startsWith("-"));
  const recursive = flags.includes("--recursive") || flags.some((flag) => !flag.startsWith("--") && /[rR]/.test(flag));
  if (!recursive) return "";
  if (args.some((arg) => ROOT_TARGETS.has(arg))) return "recursive delete of the filesystem root or home directory";
  const force = flags.includes("--force") || flags.some((flag) => !flag.startsWith("--") && flag.includes("f"));
  return force && args.some((arg) => SYSTEM_TARGETS.has(arg)) ? "recursive force-delete" : "";
}

function gitReason(args) {
  if (args[0] === "push" && args.some((arg) => arg === "--force" || arg === "-f"))
    return "force-push — it overwrites history others may have pulled";
  if (args[0] === "reset" && args.includes("--hard") && args.some((arg) => /^(?:origin\/)?(?:main|master|develop)$/.test(arg)))
    return "hard reset onto a shared branch — local work is discarded";
  return "";
}

function sqlReasons(call) {
  const sql = /^(?:psql|mysql|sqlite3)$/.test(call.argv[0]) ? call.argv.slice(1).join(" ") : call.text;
  if (!/^(?:psql|mysql|sqlite3|DROP|TRUNCATE|DELETE|UPDATE)$/i.test(call.argv[0])) return [];
  const statements = sql.split(";").map((part) => part.trim());
  return statements.flatMap((statement) => {
    const hits = SQL_RULES.filter(([pattern]) => pattern.test(statement)).map((rule) => rule[1]);
    if (/\bDELETE\s+FROM\s+\w+\b/i.test(statement) && !/\bWHERE\b/i.test(statement)) hits.push("DELETE with no WHERE clause — every row");
    if (/\bUPDATE\s+\w+\s+SET\b/i.test(statement) && !/\bWHERE\b/i.test(statement)) hits.push("UPDATE with no WHERE clause — every row");
    return hits;
  });
}

function commandReasons(call) {
  const [name, ...args] = call.argv;
  let reason = "";
  if (name === "rm") reason = removalReason(args);
  if (name === "git") {
    const git = gitOperation(call.argv);
    reason = gitReason([git.operation, ...git.args]);
  }
  const hits = COMMAND_RULES.filter(([matches]) => matches(name, args)).map((rule) => rule[1]);
  return [...(reason ? [reason] : []), ...hits, ...sqlReasons(call)];
}

let data = "";
process.stdin.on("data", (c) => {
  data += c;
});
process.stdin.on("end", () => {
  const mode = (process.env.CLAUDE_DESTRUCTIVE_GATE || "block").toLowerCase();
  if (mode === "off") process.exit(0);

  let input;
  try {
    input = JSON.parse(data || "{}");
  } catch {
    process.exit(0); // never fail a tool call because the hook could not read its own input
  }

  const raw = String(input.tool_input?.command || "");
  if (!raw) process.exit(0);
  const calls = commandInvocations(raw);
  const hits = calls.flatMap(commandReasons);
  if (calls.some((call) => call.argv[0] === ":") && /:\(\)\s*\{\s*:\s*\|\s*:&\s*\}\s*;\s*:/.test(raw))
    hits.push("fork bomb");
  if (!hits.length) process.exit(0);

  const msg = [
    "DESTRUCTIVE COMMAND BLOCKED.",
    "",
    ...hits.map((w) => `  • ${w}`),
    "",
    `Command: ${raw.split("\n")[0].slice(0, 160)}`,
    "",
    "This is irreversible, so it is the operator's decision, not the agent's. Per the",
    "Council's destructive-operation rule, confirm with the person whose data it is, then",
    "run it yourself — or narrow the command so it cannot take more than you intend",
    "(a specific path, a WHERE clause, --force-with-lease instead of --force).",
    "",
    "CLAUDE_DESTRUCTIVE_GATE=warn downgrades this; =off disables it. Neither is recommended.",
  ].join("\n");

  process.stderr.write(msg + "\n");
  if (mode === "warn") process.exit(0);
  process.exit(2);
});
