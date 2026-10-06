#!/usr/bin/env node
// Size budget: 8 KB. Check: wc -c; gate: token-budget.mjs --check.
/**
 * PostToolUse Hook: TypeScript check after editing .ts/.tsx files
 *
 * Cross-platform (Windows, macOS, Linux)
 *
 * Runs after Edit tool use on TypeScript files. Walks up from the file's
 * directory to find the nearest tsconfig.json, then runs tsc --noEmit
 * and reports only errors related to the edited file.
 */

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { redact } = require("./lib/redaction.js");
const { advise } = require("./lib/advise.js");

const MAX_STDIN = 1024 * 1024; // 1MB limit
let data = "";
process.stdin.setEncoding("utf8");

process.stdin.on("data", (chunk) => {
  if (data.length < MAX_STDIN) {
    const remaining = MAX_STDIN - data.length;
    data += chunk.substring(0, remaining);
  }
});

function configDirectory(file) {
  let directory = path.dirname(file);
  const root = path.parse(directory).root;
  for (let depth = 0; depth < 20; depth++) {
    if (fs.existsSync(path.join(directory, "tsconfig.json"))) return directory;
    if (directory === root) break;
    directory = path.dirname(directory);
  }
  return null;
}

function reportFailure(input, file, resolved, directory, error) {
  const output = String(error.stdout || "") + String(error.stderr || "");
  const candidates = [file, resolved, path.relative(directory, resolved)];
  const lines = output.split("\n")
    .filter((line) => candidates.some((candidate) => line.includes(candidate))).slice(0, 10);
  if (lines.length) {
    const heading = "[Hook] TypeScript errors in " + path.basename(file) + ":";
    advise(input, [heading, ...lines.map((line) => redact(line, 160))].join("\n"), "PostToolUse");
    return;
  }
  const reason = error.code === "ETIMEDOUT" || error.signal
    ? "compiler timed out or was interrupted"
    : "compiler unavailable, configuration invalid, or project errors outside this file";
  advise(input, "[Hook] TypeScript project check did not pass: " + reason +
    ". No passing check is claimed. Run the repository typecheck and inspect its full diagnostics.", "PostToolUse");
}

function checkFile(input) {
  const file = input.tool_input?.file_path;
  if (!file || !/\.(ts|tsx)$/.test(file)) return;
  const resolved = path.resolve(file);
  if (!fs.existsSync(resolved)) return;
  const directory = configDirectory(resolved);
  if (!directory) {
    advise(input, "[Hook] TypeScript check unavailable: no tsconfig.json found. No passing check is claimed.", "PostToolUse");
    return;
  }
  try {
    const executable = process.platform === "win32" ? "npx.cmd" : "npx";
    const output = execFileSync(executable, ["--no-install", "tsc", "--noEmit", "--pretty", "false"], {
      cwd: directory, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], timeout: 30000,
    });
    if (output.trim()) advise(input, "[Hook] TypeScript compiler output: " + redact(output, 400), "PostToolUse");
  } catch (error) {
    reportFailure(input, file, resolved, directory, error);
  }
}

process.stdin.on("end", () => {
  try { checkFile(JSON.parse(data)); }
  catch { process.stderr.write("[Hook] TypeScript check unavailable: unreadable input or file. No passing check is claimed.\n"); }
  process.exit(0);
});
