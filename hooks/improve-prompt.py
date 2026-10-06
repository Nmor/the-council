#!/usr/bin/env python3
"""UserPromptSubmit: switch on Council default mode for real requests.

The previous version injected ~960 tokens of mode scripting on EVERY prompt,
including task notifications and one-word replies, so a migration de-registered
it — which also silently removed the only per-request Council trigger: the
owner then had to NAME the Council to get Council behavior. This version
injects one bounded activation block on real prompts and stays silent on
everything else. A prompt hook must never block a prompt: every path exits 0.
"""
import json
import sys

# Slash commands, memorize notes and the explicit '*' opt-out pass untouched.
BYPASS_PREFIXES = ('/', '#', '*')
# System-generated turns are not user requests; re-activating on them is noise.
SYSTEM_MARKERS = ('<task-notification>', '<system-reminder>', '[Request interrupted')
# A bare acknowledgement ("ok", "yes", "do it") continues the mode already set.
ACK_LIMIT = 12

ACTIVATION = (
    'Council default mode is ON for this request - it applies to every project '
    'and never needs to be named. Proportionate intake first (trivial: a '
    'sentence; vague: invoke prompt-improver; non-trivial: intake and plan '
    'before the first file mutation). Load the Council skills matching the '
    'files and domains touched; weigh architecture, implementation, quality, '
    'security and testing where they bear; close with the verification gates. '
    'Scale to the task - no division ceremony. An explicit Council mention '
    'asks for the deep protocol (council-protocol skill).'
)


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        return 0
    prompt = payload.get('prompt', '') if isinstance(payload, dict) else ''
    if not isinstance(prompt, str):
        return 0
    text = prompt.strip()
    if not text or len(text) <= ACK_LIMIT or text.startswith(BYPASS_PREFIXES):
        return 0
    if any(marker in text for marker in SYSTEM_MARKERS):
        return 0
    print(json.dumps({'hookSpecificOutput': {
        'hookEventName': 'UserPromptSubmit',
        'additionalContext': ACTIVATION,
    }}))
    return 0


if __name__ == '__main__':
    sys.exit(main())
