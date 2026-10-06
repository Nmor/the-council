#!/usr/bin/env node
"use strict";
// Native cross-client Go mutation guard. No Claude transcript/runtime imports.
// Register PreToolUse and PostToolUse for Bash|apply_patch|Edit|Write|MultiEdit.
// --state-dir must be client-owned (Codex council/runtime or Claude runtime).
// Before/after lexical signatures detect newly introduced blank assignments,
// including untracked tests and shell/Python writes. Existing debt is not a gate.
// This is NOT Go type analysis: bare discarded return values require errcheck.
// PostToolUse feedback cannot undo writes. Missing correlation emits a warning.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

function codeOnly(source) {
  return source.replace(
    /\/\*[\s\S]*?\*\/|\/\/[^\n]*|`[^`]*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,
    (text) => text.replace(/[^\n]/g, " "),
  );
}

function findings(source) {
  const code = codeOnly(source);
  const result = [];
  const assignment =
    /(?<![\w.])((?:[A-Za-z_]\w*\s*,\s*)*[A-Za-z_]\w*)\s*(:?=)(?!=)/g;
  for (const match of code.matchAll(assignment)) {
    const names = match[1].split(",").map((value) => value.trim());
    if (!names.includes("_")) continue;
    const tail = code.slice(match.index + match[0].length).trimStart();
    const before = code.slice(0, match.index);
    if (
      /\bfor\s*$/.test(before) &&
      /^range\b/.test(tail) &&
      names.length === 2 &&
      names[0] === "_" &&
      names[1] !== "_"
    )
      continue;
    // The signature excludes line numbers so shifting unchanged debt is silent.
    const end = code.indexOf("\n", match.index + match[0].length);
    const expression = code
      .slice(match.index, end < 0 ? code.length : end)
      .trim()
      .replace(/\s+/g, " ");
    result.push({ line: before.split("\n").length, signature: expression });
  }
  return result;
}

function scan(cwd, seen = new Set()) {
  let root;
  try {
    root = execFileSync("git", ["-C", cwd, "rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    if (
      error.status === 128 &&
      String(error.stderr).includes("not a git repository")
    )
      return {};
    throw error;
  }
  root = fs.realpathSync(root);
  if (seen.has(root)) return {};
  seen.add(root);
  const listed = execFileSync(
    "git",
    [
      "-C",
      root,
      "ls-files",
      "-z",
      "--cached",
      "--others",
      "--exclude-standard",
      "--",
      "*.go",
    ],
    { encoding: "utf8", timeout: 5000, maxBuffer: 4 * 1024 * 1024 },
  );
  const result = {};
  let bytes = 0;
  for (const name of new Set(listed.split("\0").filter(Boolean))) {
    const target = path.join(root, name);
    let stat;
    try {
      stat = fs.lstatSync(target);
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    if (!stat.isFile() || stat.isSymbolicLink()) continue;
    const real = fs.realpathSync(target);
    if (!real.startsWith(root + path.sep)) continue;
    bytes += stat.size;
    if (bytes > 20 * 1024 * 1024)
      throw new Error("Go scan exceeds 20 MiB; run local lint manually");
    result[real] = findings(fs.readFileSync(real, "utf8"));
  }
  return result;
}

function scanScopes(scopes) {
  const seen = new Set();
  return Object.assign({}, ...scopes.map((cwd) => scan(cwd, seen)));
}

function introduced(before, after) {
  const issues = [];
  for (const [file, values] of Object.entries(after)) {
    const counts = new Map();
    for (const item of before[file] || [])
      counts.set(item.signature, (counts.get(item.signature) || 0) + 1);
    for (const item of values) {
      const count = counts.get(item.signature) || 0;
      if (count) counts.set(item.signature, count - 1);
      else issues.push({ file, line: item.line });
    }
  }
  return issues;
}

function context(event, text) {
  return {
    hookSpecificOutput: { hookEventName: event, additionalContext: text },
  };
}

function dispatch(input, stateDir) {
  const event = input.hook_event_name;
  if (!["PreToolUse", "PostToolUse"].includes(event)) return {};
  if (
    ![
      "Bash",
      "exec_command",
      "shell_command",
      "apply_patch",
      "Edit",
      "Write",
      "MultiEdit",
      "write_stdin",
    ].includes(input.tool_name)
  )
    return {};
  const ids = [input.session_id, input.tool_use_id];
  if (!ids.every((value) => typeof value === "string" && value.length)) {
    return context(
      event,
      "Council Go no-discards check lacks a session/tool correlation ID; no mutation check is claimed. Run local lint.",
    );
  }
  if (typeof input.cwd !== "string" || !path.isAbsolute(input.cwd))
    throw new Error("absolute cwd required");
  let cwd = input.cwd;
  const workdir = input.tool_input && input.tool_input.workdir;
  if (typeof workdir === "string") cwd = path.resolve(cwd, workdir);
  const hash = (value) =>
    crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
  const args = input.tool_input || {};
  const poll = input.tool_name === "write_stdin";
  const processFile = (id) =>
    path.join(
      stateDir,
      "process-" + hash([input.session_id, String(id)]) + ".json",
    );
  let file = path.join(stateDir, hash(ids) + ".json");
  if (poll) {
    if (args.session_id == null || !fs.existsSync(processFile(args.session_id)))
      return context(
        event,
        "Council Go no-discards has no baseline for this process poll; no mutation check is claimed. Run local lint.",
      );
    file = JSON.parse(
      fs.readFileSync(processFile(args.session_id), "utf8"),
    ).file;
    if (
      path.dirname(file) !== path.resolve(stateDir) ||
      !/^[a-f0-9]{64}\.json$/.test(path.basename(file))
    )
      throw new Error("invalid process baseline reference");
    if (event === "PreToolUse") return {};
  }
  if (event === "PreToolUse") {
    const scopes = new Set([cwd]);
    const command =
      typeof args === "string"
        ? args
        : args.command || args.patch || args.input || "";
    const targets = [];
    if (
      ["apply_patch", "Edit", "Write", "MultiEdit"].includes(input.tool_name)
    ) {
      if (args.file_path) targets.push(args.file_path);
      for (const edit of args.edits || [])
        if (edit.file_path) targets.push(edit.file_path);
      for (const match of String(command).matchAll(
        /^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)$/gm,
      ))
        targets.push(match[1]);
      for (const target of targets) {
        let directory = path.dirname(path.resolve(cwd, target));
        while (
          !fs.existsSync(directory) &&
          path.dirname(directory) !== directory
        )
          directory = path.dirname(directory);
        scopes.add(directory);
      }
    }
    const snapshot = scanScopes([...scopes]);
    fs.mkdirSync(stateDir, { recursive: true, mode: 0o700 });
    for (const name of fs.readdirSync(stateDir)) {
      if (!/^(?:process-)?[a-f0-9]{64}\.json$/.test(name)) continue;
      const stale = path.join(stateDir, name);
      try {
        if (Date.now() - fs.statSync(stale).mtimeMs > 86400000)
          fs.unlinkSync(stale);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    const temporary = file + "." + process.pid + ".tmp";
    fs.writeFileSync(
      temporary,
      JSON.stringify({ scopes: [...scopes], snapshot }),
      { mode: 0o600 },
    );
    fs.renameSync(temporary, file);
    return {};
  }
  let response = input.tool_response;
  if (typeof response === "string") {
    try {
      response = JSON.parse(response);
    } catch {
      const runningText = response.match(
        /Process running with session ID (\d+)/,
      );
      if (runningText) response = { session_id: runningText[1] };
    }
  }
  const running =
    response &&
    typeof response === "object" &&
    (response.session_id != null ||
      ["running", "pending"].includes(response.status));
  if (!fs.existsSync(file))
    return context(
      event,
      "Council Go no-discards baseline is unavailable; no mutation check is claimed. Run local lint.",
    );
  const saved = JSON.parse(fs.readFileSync(file, "utf8"));
  const before = saved.snapshot;
  const after = scanScopes(saved.scopes);
  const issues = introduced(before, after);
  if (running) {
    // Inspect writes visible now, retain updated baseline for terminal or poll output.
    fs.writeFileSync(
      file,
      JSON.stringify({ scopes: saved.scopes, snapshot: after }),
      { mode: 0o600 },
    );
    if (response.session_id != null)
      fs.writeFileSync(
        processFile(response.session_id),
        JSON.stringify({ file }),
        { mode: 0o600 },
      );
  } else {
    fs.unlinkSync(file);
    if (poll && fs.existsSync(processFile(args.session_id)))
      fs.unlinkSync(processFile(args.session_id));
  }
  if (!issues.length && running)
    return context(
      event,
      "Council Go mutation scan inspected currently visible files; the command is still running. Later writes require its terminal PostToolUse event or a correlated write_stdin hook; no completion is claimed.",
    );
  if (!issues.length) return {};
  const message =
    "Council no-discards: newly introduced Go blank-identifier assignments (tests included):\n" +
    issues
      .slice(0, 20)
      .map((issue) => `${issue.file}:${issue.line}`)
      .join("\n") +
    (issues.length > 20 ? `\n... ${issues.length - 20} more` : "") +
    "\nHandle returned values/errors before completion. for _, value := range is allowed. The write has already occurred; this check does not undo it. Run errcheck for type-aware discarded-call checks.";
  return { decision: "block", reason: message, ...context(event, message) };
}

if (require.main === module) {
  let data = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    data += chunk;
  });
  process.stdin.on("end", () => {
    try {
      const index = process.argv.indexOf("--state-dir");
      if (
        index < 0 ||
        !process.argv[index + 1] ||
        !path.isAbsolute(process.argv[index + 1])
      )
        throw new Error("--state-dir must be absolute");
      const input = JSON.parse(data);
      process.stdout.write(
        JSON.stringify(dispatch(input, process.argv[index + 1])) + "\n",
      );
    } catch (error) {
      process.stdout.write(
        JSON.stringify({
          systemMessage:
            "Council Go no-discards check failed: " +
            error.message +
            ". No check is claimed; run local lint.",
        }) + "\n",
      );
    }
  });
}
module.exports = { findings, introduced, dispatch };
