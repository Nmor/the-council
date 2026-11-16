"""Sync must preserve the native installer's ownership and rollback graph."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('sync_installer', ROOT / 'bootstrap/codex.py')
installer = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(installer)


class SyncTests(unittest.TestCase):
    def test_native_sync_keeps_ownership_and_remains_reversible(self):
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory)
            native = home / '.codex'
            native.mkdir()
            originals = {'AGENTS.md': b'Personal instructions\n',
                         'hooks.json': b'{"hooks": {}}\n',
                         'config.toml': b'model = "personal-model"\n'}
            for name, content in originals.items():
                self.assertEqual((native / name).write_bytes(content), len(content))
            installed = installer.install(native, ROOT)
            self.assertGreater(installed['files'], 0)
            manifest = native / installer.MANIFEST
            before = json.loads(manifest.read_text())
            # Native sync deliberately uses the checked-out corpus, not raw
            # Claude files which would remove adapted paths and ownership.
            canonical = home / '.claude/rules/common'
            canonical.mkdir(parents=True)
            self.assertGreater((canonical / 'coding-style.md').write_text('unadapted source'), 0)
            result = subprocess.run(['bash', str(ROOT / 'scripts/council-sync.sh')],
                                    env={**os.environ, 'HOME': str(home),
                                         'PATH': str(Path(sys.executable).parent) + os.pathsep + os.environ['PATH']},
                                    capture_output=True, text=True, timeout=60, check=False)
            self.assertEqual(result.returncode, 0, result.stderr)
            after = json.loads(manifest.read_text())
            self.assertEqual(after, before)
            self.assertEqual(installer.verify(native)['integrity'], 'passed')
            uninstalled = installer.uninstall(native)
            self.assertGreater(uninstalled['files'], 0)
            for name, content in originals.items():
                self.assertEqual((native / name).read_bytes(), content)


if __name__ == '__main__':
    unittest.main()
