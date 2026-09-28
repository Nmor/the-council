"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { execFileSync } = require("node:child_process");
const script =
  process.env.COUNCIL_GO_GUARD ||
  path.resolve(__dirname, "../../scripts/hooks/go-discard-mutations.js");
const guard = require(script);
const python =
  process.env.COUNCIL_TEST_PYTHON ||
  (process.platform === "win32" ? "python" : "python3");

test("Go lexical policy catches assignments, preserves exact allowed ranges, ignores strings/comments", () => {
  for (const source of [
    "_, err := f()",
    "x, _ := f()",
    "_ = f()",
    "if _, err := f(); err != nil {}",
    "func f() { _ = call() }",
    "x,\n_ := f()",
    "for k, _ := range values {}",
    "for _ = range values {}",
  ]) {
    assert.ok(guard.findings(source).length, source);
  }
  for (const source of [
    "for _, v := range values {}",
    "// _ = f()",
    "/*\n_ = f()\n*/",
    "s := `_ = f()`",
    's := "_, err = f()"',
    "var _ Interface = (*T)(nil)",
    "func f(_ string) {}",
    "value, err := f()",
  ]) {
    assert.deepEqual(guard.findings(source), [], source);
  }
});

function fixture(t) {
  const base = fs.mkdtempSync(
    path.join(os.tmpdir(), "council-discard-fixture-"),
  );
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const root = path.join(base, "repo");
  fs.mkdirSync(root);
  execFileSync("git", ["init", "-q", root]);
  const state = path.join(base, "state");
  let index = 0;
  return {
    root,
    state,
    event(tool, args) {
      return {
        cwd: root,
        session_id: "session",
        tool_use_id: String(++index),
        tool_name: tool,
        tool_input: args,
      };
    },
    hook(input, event, response) {
      return JSON.parse(
        execFileSync(process.execPath, [script, "--state-dir", state], {
          input: JSON.stringify({
            ...input,
            hook_event_name: event,
            tool_response: response,
          }),
          encoding: "utf8",
        }),
      );
    },
  };
}

for (const [client, tool, args] of [
  [
    "Codex",
    "apply_patch",
    {
      command:
        "*** Begin Patch\n*** Add File: sample_test.go\n+package sample\n+func f() { _ = call() }\n*** End Patch",
    },
  ],
  [
    "Claude",
    "Write",
    {
      file_path: "sample_test.go",
      content: "package sample\nfunc f() { _ = call() }\n",
    },
  ],
  [
    "Claude",
    "Edit",
    {
      file_path: "sample_test.go",
      old_string: "call()",
      new_string: "_ = call()",
    },
  ],
  ["Codex", "Bash", { command: "python3 generate.py" }],
  ["Claude", "Bash", { command: "python3 generate.py" }],
]) {
  test(`${client} ${tool}: actual write blocks newly introduced untracked Go test discard`, (t) => {
    const f = fixture(t);
    const e = f.event(tool, args);
    assert.deepEqual(f.hook(e, "PreToolUse"), {});
    execFileSync(
      python,
      [
        "-c",
        "from pathlib import Path; Path('sample_test.go').write_text('package sample\\nfunc f() { _ = call() }\\n')",
      ],
      { cwd: f.root },
    );
    const result = f.hook(e, "PostToolUse", { exit_code: 0 });
    assert.equal(result.decision, "block");
    assert.match(result.reason, /sample_test.go:2/);
    assert.match(result.reason, /already occurred/);
    assert.equal(fs.readdirSync(f.state).length, 0);
  });
  test(`${client} ${tool}: read-only and correctly handled return values remain silent`, (t) => {
    const f = fixture(t);
    const debt = path.join(f.root, "debt.go");
    fs.writeFileSync(debt, "package old\nfunc f() { _ = old() }\n");
    const e = f.event(tool, args);
    f.hook(e, "PreToolUse");
    assert.deepEqual(f.hook(e, "PostToolUse", { exit_code: 0 }), {});
    const mutation = f.event(tool, args);
    f.hook(mutation, "PreToolUse");
    fs.writeFileSync(
      path.join(f.root, "new.go"),
      "package good\nfunc f() { value, err := call(); use(value, err) }\n",
    );
    assert.deepEqual(f.hook(mutation, "PostToolUse", { exit_code: 0 }), {});
  });
}

test("tracked changed files, shifted debt, duplicate signatures and failed writes", (t) => {
  const f = fixture(t);
  const file = path.join(f.root, "tracked.go");
  fs.writeFileSync(file, "package p\nfunc f() { _ = old() }\n");
  execFileSync("git", ["-C", f.root, "add", "tracked.go"]);
  const e = f.event("Bash", { command: "python edit.py" });
  f.hook(e, "PreToolUse");
  fs.writeFileSync(file, "// shifted\npackage p\nfunc f() { _ = old() }\n");
  assert.deepEqual(f.hook(e, "PostToolUse", { exit_code: 0 }), {});
  const twice = f.event("Bash", { command: "python edit.py" });
  f.hook(twice, "PreToolUse");
  fs.appendFileSync(file, "func other() { _ = old() }\n");
  assert.equal(
    f.hook(twice, "PostToolUse", { exit_code: 1 }).decision,
    "block",
  );
});

test("running command preserves baseline until completion; lack of baseline explicitly warns", (t) => {
  const f = fixture(t);
  const e = f.event("Bash", { command: "long-running" });
  f.hook(e, "PreToolUse");
  assert.match(
    f.hook(e, "PostToolUse", { session_id: 2 }).hookSpecificOutput
      .additionalContext,
    /still running/,
  );
  assert.equal(fs.readdirSync(f.state).length, 2);
  fs.writeFileSync(
    path.join(f.root, "new.go"),
    "package p\nfunc f() { _, err := call() }",
  );
  assert.equal(f.hook(e, "PostToolUse", { exit_code: 0 }).decision, "block");
  assert.match(
    f.hook(e, "PostToolUse", { exit_code: 0 }).hookSpecificOutput
      .additionalContext,
    /no mutation check is claimed/,
  );
});

test("symlink escapes ignored and arbitrary command text does not create false mutation claims", (t) => {
  const f = fixture(t);
  const outside = path.join(path.dirname(f.root), "outside.go");
  fs.writeFileSync(outside, "_ = call()");
  try {
    fs.symlinkSync(outside, path.join(f.root, "linked.go"));
  } catch (error) {
    if (process.platform === "win32" && error.code === "EPERM") {
      t.skip(
        "Windows account lacks the symbolic-link privilege; other path-escape fixtures still run",
      );
      return;
    }
    throw error;
  }
  const e = f.event("Bash", { command: 'rg "_ = call()" .' });
  f.hook(e, "PreToolUse");
  assert.deepEqual(f.hook(e, "PostToolUse", { exit_code: 0 }), {});
});

test("absolute cross-repository patch targets are scanned outside session cwd", (t) => {
  const f = fixture(t);
  const other = path.join(path.dirname(f.root), "integration");
  fs.mkdirSync(other);
  execFileSync("git", ["init", "-q", other]);
  const target = path.join(other, "new_test.go");
  const e = f.event("apply_patch", {
    command: `*** Begin Patch\n*** Add File: ${target}\n+package p\n+func f(){ _ = call() }\n*** End Patch`,
  });
  f.hook(e, "PreToolUse");
  fs.writeFileSync(target, "package p\nfunc f(){ _ = call() }\n");
  assert.match(
    f.hook(e, "PostToolUse", {}).reason,
    /integration.*new_test.go:2/,
  );
});
test("exec workdir overrides session cwd and asynchronous write_stdin sees later writes", (t) => {
  const f = fixture(t);
  const other = path.join(path.dirname(f.root), "workdir");
  fs.mkdirSync(other);
  execFileSync("git", ["init", "-q", other]);
  const e = f.event("exec_command", { cmd: "python async.py", workdir: other });
  f.hook(e, "PreToolUse");
  assert.match(
    f.hook(e, "PostToolUse", { session_id: 42 }).hookSpecificOutput
      .additionalContext,
    /still running/,
  );
  fs.writeFileSync(
    path.join(other, "later.go"),
    "package p\nfunc f(){ value, _ := call() }\n",
  );
  const poll = f.event("write_stdin", { session_id: 42 });
  assert.deepEqual(f.hook(poll, "PreToolUse"), {});
  assert.match(
    f.hook(poll, "PostToolUse", { exit_code: 0 }).reason,
    /workdir.*later.go:2/,
  );
  assert.equal(fs.readdirSync(f.state).length, 0);
});
test("missing IDs, corrupt baseline and scan size limit report no-check feedback", (t) => {
  const f = fixture(t);
  const e = f.event("Bash", { command: "echo read" });
  const missing = { ...e };
  delete missing.tool_use_id;
  assert.match(
    f.hook(missing, "PreToolUse").hookSpecificOutput.additionalContext,
    /no mutation check is claimed/,
  );
  f.hook(e, "PreToolUse");
  const state = path.join(f.state, fs.readdirSync(f.state)[0]);
  fs.writeFileSync(state, "broken json");
  assert.match(
    f.hook(e, "PostToolUse", {}).systemMessage,
    /No check is claimed/,
  );
  fs.writeFileSync(
    path.join(f.root, "too-large.go"),
    " ".repeat(20 * 1024 * 1024 + 1),
  );
  assert.match(
    f.hook(f.event("Bash", { command: "read" }), "PreToolUse").systemMessage,
    /20 MiB/,
  );
});
test("string-wrapped native running result keeps correlation and scans visible writes", (t) => {
  const f = fixture(t);
  const e = f.event("Bash", { command: "async" });
  f.hook(e, "PreToolUse");
  fs.writeFileSync(
    path.join(f.root, "initial.go"),
    "package p\nfunc f(){ _ = call() }\n",
  );
  assert.equal(
    f.hook(e, "PostToolUse", JSON.stringify({ session_id: 33 })).decision,
    "block",
  );
  const poll = f.event("write_stdin", { session_id: 33 });
  f.hook(poll, "PreToolUse");
  assert.deepEqual(f.hook(poll, "PostToolUse", { exit_code: 0 }), {});
});
