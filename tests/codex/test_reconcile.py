"""Legacy reconciliation must retain owner content without relaxing normal installs."""
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from test_install import ROOT, installer, snapshot


class MetadataTests(unittest.TestCase):
    def test_folded_and_literal_descriptions(self):
        for indicator, expected in [('>-', 'first second\nparagraph'),
                                    ('>', 'first second\nparagraph\n'),
                                    ('|-', 'first\nsecond\n\nparagraph'),
                                    ('|', 'first\nsecond\n\nparagraph\n')]:
            with self.subTest(indicator=indicator):
                name, description, body = installer.metadata(
                    f'---\nname: example\ndescription: {indicator}\n'
                    '  first\n  second\n\n  paragraph\nmodel: inherited\n---\nBody\n')
                self.assertEqual(name, 'example')
                self.assertEqual(description, expected)
                self.assertEqual(body, 'Body\n')

    def test_folded_multiple_blank_lines_and_quotes(self):
        name, description, body = installer.metadata(
            '---\nname: "example"\ndescription: >-\n  first\n\n\n  second\n---\nBody\n')
        self.assertEqual((name, description, body), ('example', 'first\n\nsecond', 'Body\n'))

    def test_malformed_or_ambiguous_metadata_refused(self):
        for front in ['name: a\nname: b', 'description: >-', 'name: >-\n  bad',
                      'description: [not, a, scalar]', 'description: >-\n  a\n    b',
                      'description: "unterminated', 'description:\nmodel: sonnet']:
            with self.subTest(front=front):
                with self.assertRaises((ValueError, json.JSONDecodeError)):
                    installer.metadata(f'---\n{front}\n---\nBody\n')

    def test_all_shipped_metadata_is_consumable(self):
        for path in list((ROOT / 'agents').glob('*.md')) + list((ROOT / 'skills').glob('*/SKILL.md')):
            with self.subTest(path=str(path.relative_to(ROOT))):
                name, description, body = installer.metadata(path.read_text(encoding='utf-8'))
                self.assertTrue(name)
                self.assertTrue(description.strip())
                self.assertTrue(body.strip())


class ReconcileTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.home = self.base / 'codex'
        self.home.mkdir()
        (self.home / 'config.toml').write_bytes(b'model_auto_compact_token_limit = 150000\n')
        (self.home / 'AGENTS.md').write_bytes(b'Owner policy before Council\n')
        (self.home / 'hooks.json').write_text(json.dumps({'hooks': {'Stop': [
            {'hooks': [{'type': 'command', 'command': 'echo personal'}]}]}}), encoding='utf-8')
        installer.install(self.home, ROOT)

    def manifest(self):
        return json.loads((self.home / installer.MANIFEST).read_bytes())

    def save_manifest(self, value):
        (self.home / installer.MANIFEST).write_bytes(installer.json_bytes(value))

    def legacy(self):
        value = self.manifest()
        for name in list(value['files']):
            if name in ('AGENTS.md', 'hooks.json', 'skills/council/SKILL.md') or name.startswith('agents/'):
                del value['files'][name]
        self.save_manifest(value)
        path = self.home / 'AGENTS.md'
        path.write_bytes(path.read_bytes() + b'\nCommit first, then review and test.\n')
        (self.home / 'council/catalog.md').write_bytes(b'Old manually maintained catalog\n')
        resource = self.home / 'council/resources/rules-library/owner-extension.md'
        resource.parent.mkdir(parents=True, exist_ok=True)
        resource.write_bytes(b'# Owner extension\nPreserve this rule.\n')
        return resource

    def test_legacy_reconciliation_preserves_owner_and_trust_configuration(self):
        resource = self.legacy()
        before = snapshot(self.home)
        result = installer.install(self.home, ROOT, reconcile=True)
        # AGENTS.md is adopted as MANAGED: owner text survives outside one
        # regenerated Council block (a frozen local copy bricked reinstall).
        agents = (self.home / 'AGENTS.md').read_bytes()
        self.assertEqual(agents.count(installer.BEGIN.encode()), 1)
        self.assertEqual(agents.count(installer.END.encode()), 1)
        self.assertEqual(agents.count(b'Owner policy before Council'), 1)
        self.assertEqual(agents.count(b'Commit first, then review and test.'), 1)
        self.assertEqual(agents.index(b'Owner policy before Council'), 0)
        self.assertEqual((self.home / 'config.toml').read_bytes(), before['config.toml'])
        self.assertEqual((self.home / 'hooks.json').read_bytes(), before['hooks.json'])
        self.assertEqual(resource.read_bytes(), b'# Owner extension\nPreserve this rule.\n')
        self.assertIn(resource.relative_to(self.home).as_posix(), result['retained_local'])
        backup = Path(result['backup'])
        self.assertEqual((backup / 'AGENTS.md').read_bytes(), before['AGENTS.md'])
        if os.name != 'nt':
            self.assertEqual(backup.stat().st_mode & 0o777, 0o700)
            self.assertEqual((backup / 'config.toml').stat().st_mode & 0o777, 0o600)
        restore = json.loads((backup / 'restore.json').read_bytes())
        self.assertEqual(restore['home'], str(self.home))
        self.assertEqual(installer.verify(self.home)['integrity'], 'passed')
        installed = snapshot(self.home)
        installer.install(self.home, ROOT)
        self.assertEqual(snapshot(self.home), installed)
        installer.uninstall(self.home)
        self.assertEqual(resource.read_bytes(), before[resource.relative_to(self.home).as_posix()])
        # Uninstall removes the Council block and keeps owner text, so a
        # fresh install works (the frozen-local design left the block behind
        # and the orphaned marker refused every subsequent install).
        self.assertEqual((self.home / 'AGENTS.md').read_bytes(),
                         b'Owner policy before Council\n\n'
                         b'Commit first, then review and test.\n')
        self.assertFalse((self.home / 'agents/council-architect.toml').exists())
        self.assertFalse((self.home / 'skills/council/SKILL.md').exists())
        hooks = json.loads((self.home / 'hooks.json').read_bytes())
        self.assertEqual(hooks['hooks']['Stop'], [{'hooks': [{'type': 'command', 'command': 'echo personal'}]}])
        installer.install(self.home, ROOT)
        reinstalled = (self.home / 'AGENTS.md').read_bytes()
        self.assertEqual(reinstalled.count(installer.BEGIN.encode()), 1)
        self.assertEqual(reinstalled.count(b'Owner policy before Council'), 1)

    def test_dry_run_is_read_only_and_reports_retained_files(self):
        resource = self.legacy()
        before = snapshot(self.base)
        result = installer.install(self.home, ROOT, reconcile=True, dry_run=True)
        self.assertIsNone(result['backup'])
        self.assertIn(resource.relative_to(self.home).as_posix(), result['retained_local'])
        self.assertEqual(snapshot(self.base), before)

    def test_legacy_owner_project_mapping_survives_uninstall(self):
        manifest = self.manifest()
        del manifest['files']['council/projects.json']
        self.save_manifest(manifest)
        path = self.home / 'council/projects.json'
        content = b'{"projects": [{"root": "/owner/project", "plan": "/owner/plan.md"}]}'
        self.assertEqual(path.write_bytes(content), len(content))
        installer.install(self.home, ROOT, reconcile=True)
        installer.uninstall(self.home)
        self.assertEqual(path.read_bytes(), content)

    def test_changed_guidance_and_retired_managed_extensions_survive(self):
        path = self.home / 'council/resources/agents/architect.md'
        content = path.read_bytes() + b'\nOwner architecture rule.\n'
        path.write_bytes(content)
        retired = self.home / 'council/resources/skills/local-vendor/SKILL.md'
        retired.parent.mkdir(parents=True)
        retired.write_bytes(b'Local vendor procedure\n')
        manifest = self.manifest()
        name = retired.relative_to(self.home).as_posix()
        manifest['files'][name] = {'sha256': installer.digest(retired.read_bytes()), 'original': None}
        self.save_manifest(manifest)
        installer.install(self.home, ROOT, reconcile=True)
        self.assertEqual(path.read_bytes(), content)
        self.assertTrue(self.manifest()['files'][name]['local'])
        installer.install(self.home, ROOT)
        self.assertEqual(path.read_bytes(), content)
        installer.uninstall(self.home)
        self.assertEqual(retired.read_bytes(), b'Local vendor procedure\n')

    def test_standard_install_still_refuses_drift(self):
        self.legacy()
        before = snapshot(self.home)
        with self.assertRaisesRegex(ValueError, 'changed or missing'):
            installer.install(self.home, ROOT)
        self.assertEqual(snapshot(self.home), before)

    def test_local_resource_collision_with_new_upstream_guidance_is_retained(self):
        name = 'council/resources/agents/config-reviewer.md'
        manifest = self.manifest()
        del manifest['files'][name]
        self.save_manifest(manifest)
        path = self.home / name
        content = path.read_bytes() + b'\nOwner config guidance\n'
        self.assertEqual(path.write_bytes(content), len(content))
        installer.install(self.home, ROOT, reconcile=True)
        self.assertEqual(path.read_bytes(), content)
        self.assertTrue(self.manifest()['files'][name]['local'])

    def test_full_profile_keeps_retired_skill_discoverable_across_profile_changes(self):
        resource = self.home / 'council/resources/skills/retired-local/SKILL.md'
        resource.parent.mkdir(parents=True)
        content = b'---\nname: retired-local\ndescription: Owner skill\n---\n# Retain this\n'
        self.assertEqual(resource.write_bytes(content), len(content))
        manifest = self.manifest()
        name = resource.relative_to(self.home).as_posix()
        manifest['files'][name] = {'sha256': installer.digest(content), 'original': None}
        self.save_manifest(manifest)
        installer.install(self.home, ROOT, reconcile=True, skill_profile='full')
        wrapper = self.home / 'skills/council-retired-local/SKILL.md'
        self.assertIn(str(resource), wrapper.read_text(encoding='utf-8'))
        installer.install(self.home, ROOT)
        self.assertTrue(wrapper.exists())
        installer.install(self.home, ROOT, skill_profile='compact')
        self.assertFalse(wrapper.exists())
        installer.install(self.home, ROOT, skill_profile='full')
        self.assertTrue(wrapper.exists())
        self.assertEqual(installer.verify(self.home)['integrity'], 'passed')

    def test_legacy_descriptions_may_differ_without_changing_role_authority(self):
        self.legacy()
        role = self.home / 'agents/council-architect.toml'
        text = role.read_text(encoding='utf-8')
        description_line = next(line for line in text.splitlines() if line.startswith('description ='))
        changed = text.replace(description_line, 'description = "Previous reviewed description"')
        self.assertEqual(role.write_text(changed, encoding='utf-8'), len(changed))
        installer.install(self.home, ROOT, reconcile=True)
        self.assertEqual(installer.verify(self.home)['integrity'], 'passed')

    def test_missing_managed_file_is_not_adopted(self):
        (self.home / 'council/hooks.py').unlink()
        before = snapshot(self.home)
        with self.assertRaisesRegex(ValueError, 'missing'):
            installer.install(self.home, ROOT, reconcile=True)
        self.assertEqual(snapshot(self.home), before)

    def test_changed_executable_is_not_adopted(self):
        (self.home / 'council/hooks.py').write_bytes(b'print("unreviewed")\n')
        before = snapshot(self.home)
        with self.assertRaisesRegex(ValueError, 'Changed native asset'):
            installer.install(self.home, ROOT, reconcile=True)
        self.assertEqual(snapshot(self.home), before)

    def test_unrecognized_role_and_router_are_not_adopted(self):
        self.legacy()
        role = self.home / 'agents/council-architect.toml'
        role.write_bytes(role.read_bytes() + b'model = "override"\n')
        before = snapshot(self.home)
        with self.assertRaisesRegex(ValueError, 'Unrecognized legacy agent'):
            installer.install(self.home, ROOT, reconcile=True)
        self.assertEqual(snapshot(self.home), before)

    def test_unknown_hook_cannot_be_trusted_through_reconciliation(self):
        hooks = json.loads((self.home / 'hooks.json').read_bytes())
        hooks['hooks']['Stop'][-1]['hooks'][0]['command'] += ' && echo unexpected'
        (self.home / 'hooks.json').write_bytes(installer.json_bytes(hooks))
        before = snapshot(self.home)
        with self.assertRaisesRegex(ValueError, 'Unrecognized Council hook'):
            installer.install(self.home, ROOT, reconcile=True)
        self.assertEqual(snapshot(self.home), before)

    def test_windows_hook_paths_do_not_evade_unknown_native_hook_refusal(self):
        hooks = json.loads((self.home / 'hooks.json').read_bytes())
        handler = hooks['hooks']['Stop'][-1]['hooks'][0]
        handler['commandWindows'] = r'python C:\Users\Owner\.codex\Council\hooks.py --unexpected'
        content = installer.json_bytes(hooks)
        self.assertEqual((self.home / 'hooks.json').write_bytes(content), len(content))
        before = snapshot(self.home)
        with self.assertRaisesRegex(ValueError, 'Unrecognized Council hook'):
            installer.install(self.home, ROOT, reconcile=True)
        self.assertEqual(snapshot(self.home), before)

    def test_ambiguous_markers_and_symlink_extensions_refuse(self):
        path = self.home / 'AGENTS.md'
        path.write_bytes(path.read_bytes() + installer.BEGIN.encode())
        with self.assertRaisesRegex(ValueError, 'Ambiguous'):
            installer.install(self.home, ROOT, reconcile=True)

    @unittest.skipIf(os.name == 'nt', 'symlinks require privileges on Windows')
    def test_symlink_extension_refuses(self):
        path = self.home / 'council/resources/owner-link.md'
        path.symlink_to(self.home / 'config.toml')
        with self.assertRaisesRegex(ValueError, 'symlink'):
            installer.install(self.home, ROOT, reconcile=True)

    def test_reconciliation_rolls_back_partial_install(self):
        self.legacy()
        before = snapshot(self.home)
        actual = installer.atomic_write
        writes = 0

        def fail_once(path, content, mode=0o644):
            nonlocal writes
            if path.is_relative_to(self.home):
                writes += 1
                if writes == 12:
                    raise OSError('injected failure')
            return actual(path, content, mode)

        with patch.object(installer, 'atomic_write', side_effect=fail_once):
            with self.assertRaisesRegex(OSError, 'injected failure'):
                installer.install(self.home, ROOT, reconcile=True)
        self.assertEqual(snapshot(self.home), before)
        backups = list(self.base.glob('council-reconcile-*'))
        self.assertEqual(len(backups), 1)
        self.assertEqual((backups[0] / installer.MANIFEST).read_bytes(), before[installer.MANIFEST])

    def test_reconcile_requires_existing_install(self):
        empty = self.base / 'empty'
        with self.assertRaisesRegex(ValueError, 'existing Council manifest'):
            installer.install(empty, ROOT, reconcile=True, dry_run=True)
        self.assertFalse(empty.exists())

    def test_invalid_local_flag_refuses(self):
        manifest = self.manifest()
        manifest['files']['AGENTS.md']['local'] = 'false'
        self.save_manifest(manifest)
        with self.assertRaisesRegex(ValueError, 'retained-local'):
            installer.load_manifest(self.home)
