"""Sync must preserve the native installer's ownership and rollback graph."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from shell_support import bash_path, shell_environment

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('sync_installer', ROOT / 'bootstrap/codex.py')
installer = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(installer)


class SyncTests(unittest.TestCase):
    def install(self, home, profile='compact'):
        result = subprocess.run([sys.executable, '-m', 'bootstrap.codex', 'install',
                                 '--home', str(home / '.codex'), '--skill-profile', profile],
                                cwd=ROOT, env={**os.environ,
                                               'PATH': str(Path(sys.executable).parent) + os.pathsep + os.environ['PATH']},
                                capture_output=True, text=True, timeout=60, check=False)
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    def run_sync(self, home):
        return subprocess.run([bash_path(), (ROOT / 'scripts/council-sync.sh').as_posix()],
                              env=shell_environment(home),
                              capture_output=True, text=True, timeout=60, check=False)

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
            installed = self.install(home)
            self.assertGreater(installed['files'], 0)
            manifest = native / installer.MANIFEST
            before = json.loads(manifest.read_text())
            # Native sync deliberately uses the checked-out corpus, not raw
            # Claude files which would remove adapted paths and ownership.
            canonical = home / '.claude/rules/common'
            canonical.mkdir(parents=True)
            self.assertGreater((canonical / 'coding-style.md').write_text('unadapted source'), 0)
            skill = home / '.claude/skills/team-skill'
            skill.mkdir(parents=True)
            self.assertGreater((skill / 'SKILL.md').write_text('Team skill'), 0)
            for harness in ('.agents', '.copilot'):
                (home / harness).mkdir()
            owned = home / '.agents/skills/personal-skill'
            owned.mkdir(parents=True)
            original = owned / 'SKILL.md'
            self.assertGreater(original.write_text('Keep my instructions'), 0)
            competing = home / '.claude/skills/personal-skill'
            competing.mkdir()
            self.assertGreater((competing / 'SKILL.md').write_text('Canonical instructions'), 0)
            result = self.run_sync(home)
            self.assertEqual(result.returncode, 0, result.stderr)
            after = json.loads(manifest.read_text())
            self.assertEqual(after, before)
            self.assertEqual(installer.verify(native)['integrity'], 'passed')
            for harness in ('.agents', '.copilot'):
                link = home / harness / 'skills/team-skill'
                self.assertTrue(link.is_symlink(), f'{link} must track later source edits')
                self.assertEqual(link.resolve(), skill.resolve())
            self.assertEqual(original.read_text(), 'Keep my instructions')
            self.assertFalse(owned.is_symlink())
            self.assertGreater((skill / 'SKILL.md').write_text('Updated team skill'), 0)
            self.assertEqual((home / '.agents/skills/team-skill/SKILL.md').read_text(),
                             'Updated team skill')
            repeated = self.run_sync(home)
            self.assertEqual(repeated.returncode, 0, repeated.stderr)
            self.assertIn('symlink parity: 0 new links', repeated.stdout)
            self.assertFalse((native / 'skills/team-skill').exists())
            broken = home / '.agents/skills/broken'
            broken.symlink_to(home / 'does-not-exist')
            rejected = self.run_sync(home)
            self.assertEqual(rejected.returncode, 1, rejected.stderr)
            self.assertIn('BROKEN: ' + str(broken), rejected.stdout)
            uninstalled = installer.uninstall(native)
            self.assertGreater(uninstalled['files'], 0)
            for name, content in originals.items():
                self.assertEqual((native / name).read_bytes(), content)

    def test_pre_profile_native_sync_migrates_via_installer(self):
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory)
            native = home / '.codex'
            native.mkdir()
            original = b'Keep my original instructions\n'
            self.assertEqual((native / 'AGENTS.md').write_bytes(original), len(original))
            installed = self.install(home, 'full')
            self.assertEqual(installed['skill_profile'], 'full')
            manifest = native / installer.MANIFEST
            before = json.loads(manifest.read_text())
            del before['skill_profile']
            text = json.dumps(before)
            self.assertEqual(manifest.write_text(text), len(text))
            result = self.run_sync(home)
            self.assertEqual(result.returncode, 0, result.stderr)
            after = json.loads(manifest.read_text())
            self.assertEqual(after['skill_profile'], 'compact')
            for name in ('AGENTS.md', 'hooks.json'):
                self.assertEqual(after['files'][name]['original'], before['files'][name]['original'])
            self.assertEqual(installer.verify(native)['integrity'], 'passed')
            uninstalled = installer.uninstall(native)
            self.assertGreater(uninstalled['files'], 0)
            self.assertEqual((native / 'AGENTS.md').read_bytes(), original)

    def test_malformed_manifest_refuses_before_writing(self):
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory)
            manifest = home / '.codex/council/manifest.json'
            manifest.parent.mkdir(parents=True)
            original = b'{"files": []}\n'
            self.assertEqual(manifest.write_bytes(original), len(original))
            result = self.run_sync(home)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('Invalid Council manifest', result.stderr)
            self.assertEqual(manifest.read_bytes(), original)


if __name__ == '__main__':
    unittest.main()
