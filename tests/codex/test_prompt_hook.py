"""The UserPromptSubmit injector: Council default mode on real prompts only.

The previous injector put ~960 tokens on every prompt including task
notifications, so a migration de-registered it — silently removing the only
per-request Council trigger on the Claude side (the owner had to NAME the
Council to get it). These tests pin the slim replacement: one bounded
activation on a real request, silence on everything else, and exit 0 always.
"""
import json
import subprocess
import unittest
from pathlib import Path

HOOK = Path(__file__).resolve().parents[2] / 'hooks/improve-prompt.py'


def run_hook(stdin: str) -> subprocess.CompletedProcess:
    return subprocess.run(['python3', str(HOOK)], input=stdin,
                          capture_output=True, text=True, timeout=10, check=False)


def run_prompt(prompt: str) -> subprocess.CompletedProcess:
    return subprocess.run(['python3', str(HOOK)], input=json.dumps({'prompt': prompt}),
                          capture_output=True, text=True, timeout=10, check=False)


class PromptHookTests(unittest.TestCase):
    def test_real_request_switches_council_default_mode_on(self):
        result = run_prompt('add retry handling to the payment webhook consumer')
        self.assertEqual(result.returncode, 0, result.stderr)
        output = json.loads(result.stdout)['hookSpecificOutput']
        self.assertEqual(output['hookEventName'], 'UserPromptSubmit')
        context = output['additionalContext']
        self.assertIn('Council default mode is ON', context)
        self.assertIn('never needs to be named', context)
        self.assertIn('official-docs-first', context)
        # One bounded block, not the old ~960-token mode script.
        self.assertLessEqual(len(context.encode()), 1000)
        self.assertNotIn('PROMPT EVALUATION', result.stdout)

    def test_bypass_prefixes_and_acknowledgements_stay_silent(self):
        for prompt in ('/compact', '# remember the port', '* just do it exactly',
                       'ok', 'yes', 'do option 1', '', '   '):
            with self.subTest(prompt=prompt):
                result = run_prompt(prompt)
                self.assertEqual(result.returncode, 0)
                self.assertEqual(result.stdout, '')

    def test_system_generated_turns_stay_silent(self):
        for prompt in ('<task-notification>monitor event body</task-notification>',
                       '<system-reminder>recalled memory</system-reminder>',
                       '[Request interrupted by user for tool use] carry on with it'):
            with self.subTest(prompt=prompt[:30]):
                self.assertEqual(run_prompt(prompt).stdout, '')

    def test_broken_payloads_never_block_the_prompt(self):
        for stdin in ('not json', '[]', 'null', '{"prompt": 7}', '{}'):
            with self.subTest(stdin=stdin):
                result = run_hook(stdin)
                self.assertEqual(result.returncode, 0)
                self.assertEqual(result.stdout, '')

    def test_installed_settings_register_exactly_this_hook(self):
        settings = json.loads((HOOK.parents[1] / 'settings.json').read_text(encoding="utf-8"))
        groups = settings['hooks']['UserPromptSubmit']
        commands = [h['command'] for g in groups for h in g['hooks']]
        self.assertEqual(commands, ['python3 "$HOME/.claude/hooks/improve-prompt.py"'])


if __name__ == '__main__':
    unittest.main()
