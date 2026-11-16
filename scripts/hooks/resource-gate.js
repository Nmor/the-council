#!/usr/bin/env node
// PreToolUse Agent|Task (via dispatch.js): advisory saturation check before a
// subagent spawns. The delegation policy allows parallel specialists bounded by
// machine load (resource-discipline); this makes the bound observable at the
// moment of dispatch. Fail-open: never blocks, only informs.
"use strict";
const { execFileSync } = require("node:child_process");
const os = require("node:os");

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => {
  input += c;
});
process.stdin.on("end", () => {
  try {
    const cores = os.cpus().length || 8;
    const load1 = os.loadavg()[0];
    let swapPct = 0;
    try {
      // macOS: "total = 10240.00M used = 9216.00M free = ..."
      const m = execFileSync("sysctl", ["-n", "vm.swapusage"], { timeout: 2000 })
        .toString()
        .match(/total = ([\d.]+)M\s+used = ([\d.]+)M/);
      if (m && Number(m[1]) > 0) swapPct = (Number(m[2]) / Number(m[1])) * 100;
    } catch {
      /* non-macOS or sysctl missing: skip swap */
    }
    const hot = load1 > cores * 1.0 || swapPct > 85;
    const warm = load1 > cores * 0.75 || swapPct > 70;
    if (!hot && !warm) return process.exit(0);
    const level = hot ? "SATURATED" : "busy";
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          additionalContext:
            `[resource-gate] machine ${level}: load ${load1.toFixed(1)}/${cores} cores` +
            (swapPct ? `, swap ${swapPct.toFixed(0)}%` : "") +
            (hot
              ? ". Dispatch sequentially, run at most ONE heavy child (browser/build) at a time, and prefer the model ladder’s cheaper tier for mechanical work."
              : ". Stagger heavy children and pass an explicit cheaper model for mechanical fan-out."),
        },
      }),
    );
  } catch {
    /* fail open */
  }
  process.exit(0);
});
process.stdin.on("error", () => process.exit(0));
