// Size budget: 4 KB. Check: wc -c; gate: token-budget.mjs --check.
"use strict";

// Which model tiers have hit a PLAN limit ("You've hit your Opus limit") on this install.
//
// Claude Code's fallbackModel chain deliberately skips rate-limit and billing errors
// (code.claude.com/docs/en/model-config, read 2026-09-25), and no hook can change the model
// or retry a request. So a tier that runs out keeps being selected, by the session and by
// every Council spawn, until a person runs /model. This file is the shared memory that lets
// the ladder route AROUND an exhausted tier instead.
//
// A record expires after TTL_MS. Plan windows reset on their own schedule and the error text
// does not carry a parseable reset time, so the cost of a stale expiry is one more failed
// call, which re-marks the tier. A success on the tier clears it at once.

const { join } = require("node:path");
const { homedir } = require("node:os");
const { readPrivate, writePrivate } = require("./private-state.js");
const { redact } = require("./redaction.js");

const TTL_MS = 5 * 60 * 60 * 1000; // one plan session window
const TIERS = ["mythos", "fable", "opus", "sonnet", "haiku"];

// Operator override (and what keeps tests off the real install).
const file = () =>
  process.env.CLAUDE_MODEL_EXHAUSTED_FILE ||
  join(homedir(), ".claude", ".local", "model-exhausted.json");

function load() {
  try {
    const o = JSON.parse(readPrivate(file(), { allowPublicFile: true }));
    if (!o || typeof o !== "object" || Array.isArray(o)) return new Map();
    return new Map(Object.entries(o).filter(([tier, record]) =>
      TIERS.includes(tier) && record && typeof record === "object" && Number.isFinite(record.at)));
  } catch (error) {
    if (error.code !== "ENOENT") process.stderr.write("[model-exhaustion] unreadable state ignored\n");
    return new Map(); // absent or unreadable means nothing is known to be exhausted
  }
}

function save(o) {
  writePrivate(file(), JSON.stringify(Object.fromEntries(o), null, 2) + "\n");
}

// Map "claude-opus-5-5", "Opus", "opus[1m]" to the ladder alias.
function tierOf(name) {
  const s = String(name || "").toLowerCase();
  return TIERS.find((t) => s.includes(t)) || null;
}

// The tier a limit message names, e.g. "You've hit your Fable limit". A session or weekly
// limit names no tier and covers every model, so there is nothing to route to.
function tierInLimitMessage(text) {
  const m = /hit your (\w+) limit/i.exec(String(text || ""));
  return m ? tierOf(m[1]) : null;
}

function exhausted(now = Date.now()) {
  const o = load();
  return [...o].filter((entry) => now - entry[1].at < TTL_MS).map((entry) => entry[0]);
}

function mark(tier, message, now = Date.now()) {
  const o = load();
  if (!TIERS.includes(tier)) throw new TypeError("Unknown model tier");
  o.set(tier, { at: now, message: redact(String(message || "")).slice(0, 200) });
  save(o);
}

function clear(tier) {
  const o = load();
  if (!o.delete(tier)) return false;
  save(o);
  return true;
}

module.exports = { exhausted, mark, clear, tierOf, tierInLimitMessage, TTL_MS };
