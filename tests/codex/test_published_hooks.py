"""Fresh installs must carry the shared libraries used by registered hooks."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('published_context', ROOT / 'bootstrap/context.py')
context = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(context)


def run(command, home):
    return subprocess.run(command, env={**os.environ, 'HOME': str(home)},
                          input='{}', capture_output=True, text=True, timeout=60, check=False)


class PublishedHooksTests(unittest.TestCase):
    def check_compaction(self, home):
        script = home / '.claude/scripts/hooks/pre-compact.js'
        result = run(['node', str(script)], home)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn('Cannot find module', result.stderr)
        log = home / '.claude/sessions/compaction-log.txt'
        self.assertIn('Context compaction triggered', log.read_text())

    def test_published_installer_carries_hook_dependencies(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            source = base / 'source'
            source.mkdir()
            (source / '.claude').symlink_to(ROOT, target_is_directory=True)
            dist = base / 'distribution'
            published = run(['bash', str(ROOT / 'scripts/council-publish.sh'), str(dist)], source)
            self.assertEqual(published.returncode, 0, published.stderr)
            consumer = base / 'consumer'
            consumer.mkdir()
            installed = run(['bash', str(dist / 'install.sh')], consumer)
            self.assertEqual(installed.returncode, 0, installed.stderr)
            for library in ('utils.js', 'package-manager.js', 'session-aliases.js'):
                self.assertEqual((consumer / '.claude/scripts/lib' / library).read_bytes(),
                                 (ROOT / 'scripts/lib' / library).read_bytes())
            self.check_compaction(consumer)
            # Exercise the registered pre-tool dispatcher as installed, so
            # library resolution cannot be masked by the source checkout.
            settings = json.loads((consumer / '.claude/settings.json').read_text())
            command = settings['hooks']['PreToolUse'][0]['hooks'][0]['command']
            result = run(['sh', '-c', command], consumer)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertNotIn('Cannot find module', result.stderr)

    def test_context_installer_carries_libraries_and_restores_personal_copy(self):
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory)
            target = home / '.claude'
            library = target / 'scripts/lib/utils.js'
            library.parent.mkdir(parents=True)
            original = b'// personal utility extension\n'
            self.assertEqual(library.write_bytes(original), len(original))
            result = context.apply(target, 'claude')
            self.assertGreater(result['files'], 0)
            # Existing differing utilities are personal: inspect a clean
            # consumer separately instead of pretending this extension runs.
            self.assertEqual(library.read_bytes(), original)
            restored = context.apply(target, 'claude', restore=True)
            self.assertGreater(restored['files'], 0)
            self.assertEqual(library.read_bytes(), original)
            library.unlink()
            installed = context.apply(target, 'claude')
            self.assertGreater(installed['files'], 0)
            self.check_compaction(home)


if __name__ == '__main__':
    unittest.main()
