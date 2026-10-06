#!/usr/bin/env python3
"""Small native Codex Council hooks; no Claude runtime or transcript access.

These hooks are reminders and a narrow patch guardrail, not a security boundary.
They do not certify tests or grant permissions. Go mutation checks run a native
Node scanner and read-only git discovery, storing temporary signature snapshots.
"""

# Size budget: 14 KB. Check: token-budget.mjs --check.
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

EVENTS = {"SessionStart", "PreToolUse", "PostToolUse", "PreCompact", "Stop"}
MAX_CONTEXT_BYTES = 2048
MAX_MESSAGE_CHARS = 650
PLAN_NAMES = {"plan.md", "implementation-plan.md", "implementation_plan.md"}


def project_plan(home, cwd):
    """Return the most specific registered existing plan, without prefix matches."""
    registry = Path(home) / "council" / "projects.json"
    if not registry.exists():
        return None
    if registry.stat().st_size > 1_048_576:
        raise ValueError("projects.json exceeds the configuration size limit")
    data = json.loads(registry.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or not isinstance(data.get("projects"), list):
        raise ValueError("projects.json must contain a projects array")
    current = Path(cwd).resolve()
    matches = []
    for entry in data["projects"]:
        if not isinstance(entry, dict):
            raise ValueError("project entries must be objects")
        root, plan = entry.get("root"), entry.get("plan")
        if not isinstance(root, str) or not isinstance(plan, str):
            raise ValueError("project root and plan must be absolute paths")
        if not Path(root).is_absolute() or not Path(plan).is_absolute():
            raise ValueError("project root and plan must be absolute paths")
        root = Path(root).resolve()
        if current == root or root in current.parents:
            matches.append((len(root.parts), Path(plan).resolve()))
    if not matches:
        return None
    selected = max(matches, key=lambda item: item[0])[1]
    if not selected.is_file():
        raise ValueError("the registered implementation plan is missing")
    return selected


def tool_text(payload):
    value = payload.get("tool_input")
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        for key in ("command", "cmd", "patch", "input"):
            if isinstance(value.get(key), str):
                return value[key]
    return ""


def patch_operations(patch):
    """Parse apply_patch file headers, retaining each file's patch content."""
    operations = []
    current = None
    for line in patch.splitlines():
        match = re.fullmatch(r"\*\*\* (Add|Update|Delete) File: (.+)", line)
        if match:
            current = {"operation": match[1].lower(), "path": match[2], "content": []}
            operations.append(current)
        elif line.startswith("*** Move to: ") and current is not None:
            current["move_to"] = line[len("*** Move to: "):]
        elif current is not None and not line.startswith("*** "):
            current["content"].append(line)
    return operations


def alternate_plan(path, cwd, canonical):
    candidate = Path(path)
    if not candidate.is_absolute():
        candidate = Path(cwd) / candidate
    candidate = candidate.resolve()
    if candidate == canonical:
        return False
    parts = candidate.parts
    agent_plans = any(parts[i] in {".claude", ".codex"} and parts[i + 1] == "plans"
                      for i in range(len(parts) - 1))
    return agent_plans or candidate.name.lower() in PLAN_NAMES


def bounded(message):
    """Limit context without reflecting arbitrary exception or tool output."""
    return message[:MAX_MESSAGE_CHARS] + ("…" if len(message) > MAX_MESSAGE_CHARS else "")


def context(event, message):
    return {"hookSpecificOutput": {"hookEventName": event, "additionalContext": bounded(message)}}


def merge_responses(event, *responses):
    """Keep independent feedback and blocking decisions in one bounded response."""
    merged = {}
    specific = {"hookEventName": event}
    for response in responses:
        for key, value in response.items():
            if key == "hookSpecificOutput" and isinstance(value, dict):
                for field, content in value.items():
                    if field == "additionalContext" and isinstance(content, str):
                        specific[field] = specific.get(field, "") + "\n" + bounded(content)
                    elif field == "permissionDecision" and isinstance(content, str) and content in {"allow", "deny", "ask"}:
                        if specific.get(field) != "deny":
                            specific[field] = content
                    elif field == "permissionDecisionReason" and isinstance(content, str):
                        specific[field] = bounded(content)
            elif key in {"systemMessage", "reason"} and isinstance(value, str):
                merged[key] = merged.get(key, "") + "\n" + bounded(value)
            elif key == "decision" and isinstance(value, str) and value in {"block", "approve"}:
                if merged.get(key) != "block":
                    merged[key] = value
    if len(specific) > 1:
        merged["hookSpecificOutput"] = specific
    # JSON escaping can expand a string beyond its character count.
    limit = MAX_MESSAGE_CHARS
    while True:
        for field in ("systemMessage", "reason"):
            if field in merged:
                merged[field] = merged[field].strip()[:limit]
        for field in ("additionalContext", "permissionDecisionReason"):
            if field in specific:
                specific[field] = specific[field].strip()[:limit]
        if len(json.dumps(merged).encode()) <= MAX_CONTEXT_BYTES:
            return merged
        limit //= 2


def input_error(error):
    # OSError strings can contain credential-bearing paths or thousands of bytes.
    detail = bounded(str(error)) if isinstance(error, ValueError) else type(error).__name__
    return {"systemMessage": "Council hook could not evaluate its input/configuration: "
            + detail + ". No verification or permission decision was made."}


def command_status(response):
    """Only explicit terminal structured exit codes count as known results."""
    if isinstance(response, str):
        try:
            response = json.loads(response)
        except (ValueError, TypeError):
            return None
    if not isinstance(response, dict):
        return None
    if response.get("session_id") is not None or response.get("status") in {"running", "pending"}:
        return None
    if response.get("isError") is True:
        return None
    code = response.get("exit_code")
    return code if type(code) is int else None


def go_mutation_guard(payload, home):
    """Native shared Node scanner; no archived Claude hook execution.

    Requires paired session/tool IDs. Older clients lacking those IDs retain
    manual lint requirements. The existing five event hooks include process polling in their matchers.
    """
    if payload.get("hook_event_name") not in {"PreToolUse", "PostToolUse"}:
        return {}
    if payload.get("tool_name") not in {"Bash", "exec_command", "shell_command", "apply_patch", "Edit", "Write", "MultiEdit", "write_stdin"}:
        return {}
    if not payload.get("session_id") or not payload.get("tool_use_id"):
        return context(payload["hook_event_name"], "Council Go no-discards lacks paired session/tool IDs; no mutation check is claimed. Run local lint.")
    script = Path(__file__).with_name("go-discard-mutations.js")
    if not script.exists():
        # Source-checkout layout only; installed runtime never executes resources/ scripts.
        script = Path(__file__).resolve().parents[1] / "scripts/hooks/go-discard-mutations.js"
    try:
        result = subprocess.run(["node", str(script), "--state-dir",
                                 str(Path(home).resolve() / "council/runtime/go-mutations")],
                                input=json.dumps(payload), capture_output=True, text=True,
                                check=True, timeout=15)
        value = json.loads(result.stdout)
        if not isinstance(value, dict):
            raise ValueError("scanner response must be an object")
        return value
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        return {"systemMessage": f"Council Go mutation check unavailable ({type(error).__name__}). No check is claimed; run local lint."}

def dispatch(payload, home):
    if not isinstance(payload, dict):
        raise ValueError("hook input must be a JSON object")
    event = payload.get("hook_event_name")
    if event not in EVENTS:
        return {}
    cwd = payload.get("cwd")
    if not isinstance(cwd, str) or not Path(cwd).is_absolute():
        raise ValueError("hook cwd must be an absolute path")
    plan = project_plan(home, cwd)
    handoff = (f"Use the existing implementation plan at {plan}. Update it in place with evidence, "
               "remaining work, and the next agent's handoff; do not create another plan.") if plan else (
               "Use the project's existing implementation plan and keep handoff evidence there. "
               "No plan is registered for this directory; locate the existing plan before creating one.")
    if event == "SessionStart":
        return context(event, "Council default mode is ON for every request; it never needs naming. "
                       "Read the installed Council instructions and relevant skills. " + handoff)
    if event in {"PreCompact", "Stop"}:
        return {"systemMessage": "Council handoff reminder: " + handoff}
    tool = payload.get("tool_name")
    text = tool_text(payload)
    if event == "PreToolUse" and tool in {"apply_patch", "Edit", "Write"} and plan:
        for operation in patch_operations(text):
            original = Path(operation["path"])
            if not original.is_absolute():
                original = Path(cwd) / original
            removes_canonical = original.resolve() == plan and (
                operation["operation"] == "delete" or bool(operation.get("move_to")))
            targets = []
            if operation["operation"] == "add":
                targets.append(operation["path"])
            if operation.get("move_to"):
                targets.append(operation["move_to"])
            if removes_canonical or any(alternate_plan(target, cwd, plan) for target in targets):
                return {"hookSpecificOutput": {
                    "hookEventName": event,
                    "permissionDecision": "deny",
                    "permissionDecisionReason": f"Council single-plan guardrail: update {plan} in place. "
                                                "This patch removes the canonical plan or creates/moves to another plan path. "
                                                "If the user changed the authoritative plan, update its registration first.",
                }}
    mutation = go_mutation_guard(payload, home)
    feedback = command_feedback(event, tool, text, payload)
    return merge_responses(event, mutation, feedback)


def command_feedback(event, tool, text, payload):
    if tool in {"Bash", "exec_command", "shell_command"}:
        if event == "PreToolUse" and re.search(
                r"\b(?:git\s+(?:push|reset|clean)|rm|terraform\s+(?:apply|destroy)|kubectl\s+delete)\b", text):
            return context(event, "Council: verify the user's authorization and target before this potentially "
                           "destructive or external operation. This reminder does not grant permission.")
        if event == "PostToolUse" and re.search(r"\b(?:test|pytest|unittest|lint|build|vet)\b", text):
            status = command_status(payload.get("tool_response"))
            if status is None:
                return context(event, "Council: no explicit terminal command result is available. Do not record "
                               "verification as successful from a running, failed-wrapper, or unknown response.")
            if status != 0:
                return context(event, f"Council: this command exited with code {status}. Record the failure and "
                               "resolve it or document the blocker before claiming verification.")
            return context(event, "Council: the command exited with code 0. Inspect its actual checks, skips, and "
                           "scope before recording evidence; this hook does not certify tests or coverage.")
    return {}


def payload_event(output):
    return output.get("hookSpecificOutput", {}).get("hookEventName", "Stop")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--home", required=True, type=Path)
    args = parser.parse_args()
    try:
        output = dispatch(json.load(sys.stdin), args.home)
    except (ValueError, OSError, TypeError) as error:
        # Do not use unsupported blocking shapes or silently imply enforcement.
        output = input_error(error)
    print(json.dumps(merge_responses(payload_event(output), output)))


if __name__ == "__main__":
    main()
