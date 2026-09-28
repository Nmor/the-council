"""Exercise installed-protocol input through the real native dispatcher."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[2] / 'codex/hooks.py'


class NativeBridge(unittest.TestCase):
    def test_shared_claude_and_codex_fixtures(self):
        fixtures = Path(__file__).with_name('test_go_discard_mutations.cjs')
        result = subprocess.run(
            ['node', '--test', str(fixtures)], capture_output=True, text=True,
            env={**os.environ, 'COUNCIL_TEST_PYTHON': sys.executable}, check=False)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_real_native_exec_python_write_and_patch_feedback(self):
        cases = [
            ('Bash', {'command': 'python3 generate.py'}),
            ('apply_patch', {'command': '*** Begin Patch\n*** Add File: n_test.go\n'
                             '+package p\n+func f(){ _ = call() }\n*** End Patch'}),
        ]
        for tool, args in cases:
            with self.subTest(tool=tool), tempfile.TemporaryDirectory() as directory:
                root = Path(directory) / 'repo'
                root.mkdir()
                home = Path(directory) / 'home'
                initialized = subprocess.run(
                    ['git', 'init', '-q', str(root)], capture_output=True, text=True,
                    check=False)
                self.assertEqual(initialized.returncode, 0, initialized.stderr)
                payload = {
                    'hook_event_name': 'PreToolUse', 'session_id': 's',
                    'tool_use_id': '1', 'cwd': str(root), 'tool_name': tool,
                    'tool_input': args,
                }

                def run_hook():
                    result = subprocess.run(
                        [sys.executable, str(SCRIPT), '--home', str(home)],
                        input=json.dumps(payload), text=True, capture_output=True,
                        check=False)
                    self.assertEqual(result.returncode, 0, result.stderr)
                    return json.loads(result.stdout)

                self.assertEqual(run_hook(), {})
                written = subprocess.run(
                    [sys.executable, '-c', "from pathlib import Path; "
                     "Path('n_test.go').write_text('package p\\nfunc f(){ _ = call() }\\n')"],
                    cwd=root, check=False, capture_output=True, text=True)
                self.assertEqual(written.returncode, 0, written.stderr)
                payload.update(hook_event_name='PostToolUse', tool_response={'exit_code': 0})
                self.assertEqual(run_hook()['decision'], 'block')

    def test_missing_node_explicit_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            payload = {
                'hook_event_name': 'PreToolUse', 'session_id': 's',
                'tool_use_id': '1', 'cwd': directory, 'tool_name': 'Bash',
                'tool_input': {'command': 'echo hi'},
            }
            result = subprocess.run(
                [sys.executable, str(SCRIPT), '--home', directory],
                input=json.dumps(payload), text=True, capture_output=True,
                check=False, env={**os.environ, 'PATH': '/nonexistent'})
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn('No check is claimed', json.loads(result.stdout)['systemMessage'])


if __name__ == '__main__':
    unittest.main()
