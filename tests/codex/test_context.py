"""Cost-profile migration must preserve personal settings and be safely reversible."""
import base64
import hashlib
import importlib.util
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import tomllib

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('context_migration', ROOT / 'bootstrap/context.py')
context = importlib.util.module_from_spec(spec)
spec.loader.exec_module(context)


def snapshot(root):
    return {p.relative_to(root).as_posix(): p.read_bytes() for p in root.rglob('*') if p.is_file()}


class ContextTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.home = Path(self.temp.name)
        self.settings = {
            'model': 'chosen-primary', 'effortLevel': 'high',
            'autoCompactEnabled': False,
            'env': {'PERSONAL': 'keep', 'autoCompactEnabled': 'false'},
            'hooks': {'UserPromptSubmit': [{'hooks': [
                {'type': 'command', 'command': 'python3 ~/.claude/hooks/improve-prompt.py'},
                {'type': 'command', 'command': 'echo personal'}]}],
                'Stop': [{'hooks': [{'type': 'command', 'command': 'echo stop'}]}]}}
        (self.home / 'settings.json').write_text(json.dumps(self.settings), encoding="utf-8")
        (self.home / 'CLAUDE.md').write_text('Personal original guidance\n', encoding="utf-8")
        (self.home / 'plans').mkdir()
        (self.home / 'plans/existing.md').write_text('Only authoritative plan', encoding="utf-8")
        (self.home / 'config.toml').write_text(
            '# personal comment\nmodel = "chosen-primary"\nmodel_reasoning_effort = "high"\n'
            '[agents] # existing agent options\nmax_threads = 8\nmax_depth = 2\n'
            '[mcp_servers.personal]\nurl = "https://example.invalid"\n', encoding="utf-8")
        self.before = snapshot(self.home)

    def test_claude_preserves_settings_runtime_data_and_originals(self):
        context.apply(self.home, 'claude')
        installed = snapshot(self.home)
        actual = json.loads(installed['settings.json'])
        self.assertEqual(actual['model'], self.settings['model'])
        self.assertEqual(actual['effortLevel'], 'high')
        self.assertEqual(actual['env']['PERSONAL'], 'keep')
        self.assertEqual(actual['hooks']['Stop'], self.settings['hooks']['Stop'])
        self.assertEqual(actual['hooks']['UserPromptSubmit'][0]['hooks'], [
            {'type': 'command', 'command': 'echo personal'}])
        self.assertNotIn('autoCompactWindow', actual)
        self.assertFalse(actual['enableArtifact'])
        self.assertTrue(actual['autoCompactEnabled'])
        self.assertNotIn('autoCompactEnabled', actual['env'])
        self.assertTrue(actual['disableWorkflows'])
        self.assertEqual(actual['env']['CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH'], '1')
        self.assertEqual(installed['plans/existing.md'], self.before['plans/existing.md'])
        self.assertTrue((self.home / 'rules-library/council-detail/council-doctrine.md').is_file())
        self.assertTrue((self.home / 'skills/brag/LICENSE').is_file())
        self.assertTrue((self.home / 'skills/brag/scripts/brag.py').is_file())
        self.assertTrue((self.home / 'scripts/hooks/go-discard-mutations.js').is_file())
        for event in ('PreToolUse', 'PostToolUse'):
            groups = actual['hooks'][event]
            guards = [hook for group in groups for hook in group['hooks']
                      if 'go-discard-mutations.js' in hook['command']]
            self.assertEqual(len(guards), 1)
            self.assertIn('--state-dir', guards[0]['command'])
        context.apply(self.home, 'claude')
        self.assertEqual(snapshot(self.home), installed)
        context.apply(self.home, 'claude', restore=True)
        self.assertEqual(snapshot(self.home), self.before)

    def test_claude_removes_council_window_and_edit_compaction_advice(self) -> None:
        """Remove owned reminders without deleting mixed personal or security hooks."""
        owned = 'node "$HOME/.claude/scripts/hooks/suggest-compact.js"'
        personal = 'node /project/personal/suggest-compact.js'
        literal = 'echo "suggest-compact.js"'
        security = 'node "$HOME/.claude/scripts/hooks/pre-push-gate.js"'
        spellings = ('$HOME/.claude', '${HOME}/.claude', '~/.claude', str(self.home))
        owned_hooks = [{'type': 'command', 'command':
                        f'node "{prefix}/scripts/hooks/suggest-compact.js"'}
                       for prefix in spellings]
        self.settings['autoCompactWindow'] = 100000
        self.settings['hooks']['PreToolUse'] = [{'matcher': 'Edit|Write', 'hooks': [*owned_hooks,
            {'type': 'command', 'command': personal},
            {'type': 'command', 'command': literal},
            {'type': 'command', 'command': security}]}]
        settings_text = json.dumps(self.settings)
        self.assertEqual((self.home / 'settings.json').write_text(settings_text, encoding="utf-8"),
                         len(settings_text))
        before = snapshot(self.home)
        context.apply(self.home, 'claude')
        actual = json.loads((self.home / 'settings.json').read_text(encoding="utf-8"))
        self.assertNotIn('autoCompactWindow', actual)
        commands = [hook['command'] for groups in actual['hooks'].values()
                    for group in groups for hook in group['hooks']]
        self.assertNotIn(owned, commands)
        for hook in owned_hooks:
            self.assertNotIn(hook['command'], commands)
        self.assertIn(personal, commands)
        self.assertIn(literal, commands)
        self.assertIn(security, commands)
        self.assertEqual(actual['hooks']['PreToolUse'][0]['matcher'], 'Edit|Write')
        installed = snapshot(self.home)
        context.apply(self.home, 'claude')
        self.assertEqual(snapshot(self.home), installed)
        context.apply(self.home, 'claude', restore=True)
        self.assertEqual(snapshot(self.home), before)

    def test_claude_preserves_explicit_window_and_artifact_choice(self) -> None:
        """Retain explicit publishing choices and non-Council windows."""
        for enabled in (True, False):
            with self.subTest(enableArtifact=enabled):
                self.settings.update(autoCompactWindow=250000, enableArtifact=enabled)
                settings_text = json.dumps(self.settings)
                self.assertEqual((self.home / 'settings.json').write_text(settings_text, encoding="utf-8"),
                                 len(settings_text))
                before = snapshot(self.home)
                context.apply(self.home, 'claude')
                actual = json.loads((self.home / 'settings.json').read_text(encoding="utf-8"))
                self.assertEqual(actual['autoCompactWindow'], 250000)
                self.assertEqual(actual['enableArtifact'], enabled)
                context.apply(self.home, 'claude', restore=True)
                self.assertEqual(snapshot(self.home), before)

    def test_managed_window_upgrade_retains_first_install_backups(self) -> None:
        """Upgrade a managed install without replacing its original restore point."""
        context.apply(self.home, 'claude')
        manifest_path = self.home / context.MANIFEST
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        original_backups = {name: entry['original'] for name, entry in manifest['files'].items()}
        settings_path = self.home / 'settings.json'
        installed_settings = json.loads(settings_path.read_text(encoding="utf-8"))
        installed_settings['autoCompactWindow'] = 100000
        del installed_settings['enableArtifact']
        installed_settings['hooks']['PreToolUse'].append({'matcher': 'Edit|Write', 'hooks': [
            {'type': 'command', 'command': 'node "$HOME/.claude/scripts/hooks/suggest-compact.js"'}]})
        settings_text = json.dumps(installed_settings)
        self.assertEqual(settings_path.write_text(settings_text, encoding="utf-8"), len(settings_text))
        manifest['files']['settings.json']['sha256'] = hashlib.sha256(settings_path.read_bytes()).hexdigest()
        manifest_text = json.dumps(manifest)
        self.assertEqual(manifest_path.write_text(manifest_text, encoding="utf-8"), len(manifest_text))
        context.apply(self.home, 'claude')
        upgraded = json.loads(settings_path.read_text(encoding="utf-8"))
        self.assertNotIn('autoCompactWindow', upgraded)
        self.assertFalse(upgraded['enableArtifact'])
        updated_manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertEqual({name: entry['original'] for name, entry in updated_manifest['files'].items()},
                         original_backups)
        after_upgrade = snapshot(self.home)
        context.apply(self.home, 'claude')
        self.assertEqual(snapshot(self.home), after_upgrade)
        context.apply(self.home, 'claude', restore=True)
        self.assertEqual(snapshot(self.home), self.before)

    def test_fresh_defaults_use_native_window_without_edit_reminders(self) -> None:
        """Keep fresh-install defaults consistent with the migration policy."""
        source = json.loads((ROOT / 'settings.json').read_text(encoding="utf-8"))
        self.assertNotIn('autoCompactWindow', source)
        self.assertTrue(source['autoCompactEnabled'])
        self.assertFalse(source['enableArtifact'])
        commands = [hook['command'] for groups in source['hooks'].values()
                    for group in groups for hook in group['hooks']]
        self.assertFalse(any('suggest-compact.js' in command for command in commands))

    def test_existing_brag_skill_collision_preserves_everything(self):
        skill = self.home / 'skills/brag/SKILL.md'
        skill.parent.mkdir(parents=True)
        skill.write_text('Independent customized BRAG skill', encoding="utf-8")
        before = snapshot(self.home)
        with self.assertRaisesRegex(ValueError, 'collision'):
            context.apply(self.home, 'claude')
        self.assertEqual(snapshot(self.home), before)

    def test_prior_brag_discovery_flag_upgrades_and_restores(self):
        skill = self.home / 'skills/brag/SKILL.md'
        skill.parent.mkdir(parents=True)
        original = (ROOT / 'skills/brag/SKILL.md').read_bytes().replace(
            b'disable-model-invocation: true\n', b'')
        skill.write_bytes(original)
        before = snapshot(self.home)
        context.apply(self.home, 'claude')
        self.assertIn(b'disable-model-invocation: true', skill.read_bytes())
        context.apply(self.home, 'claude', restore=True)
        self.assertEqual(snapshot(self.home), before)

    def test_claude_registers_the_slim_prompt_injector_once(self):
        # The legacy ~960-token injector registration is replaced by the canonical
        # slim one; the personal prompt hook survives. De-registering without a
        # replacement is what silently removed per-request Council activation.
        context.apply(self.home, 'claude')
        groups = json.loads((self.home / 'settings.json').read_text(encoding="utf-8"))['hooks']['UserPromptSubmit']
        commands = [h['command'] for g in groups for h in g['hooks']]
        self.assertEqual(commands.count('python3 "$HOME/.claude/hooks/improve-prompt.py"'), 1)
        self.assertNotIn('python3 ~/.claude/hooks/improve-prompt.py', commands)
        self.assertIn('echo personal', commands)

    def test_fresh_install_registers_the_prompt_injector(self):
        (self.home / 'settings.json').unlink()
        context.apply(self.home, 'claude')
        groups = json.loads((self.home / 'settings.json').read_text(encoding="utf-8"))['hooks']['UserPromptSubmit']
        commands = [h['command'] for g in groups for h in g['hooks']]
        self.assertEqual(commands, ['python3 "$HOME/.claude/hooks/improve-prompt.py"'])

    def test_lifecycle_upgrade_preserves_personal_hooks_and_removes_payload_echo(self):
        hooks = self.settings['hooks']
        hooks['SessionStart'] = [
            {'matcher': '*', 'hooks': [{'type': 'command', 'command':
                'node "$HOME/.claude/scripts/hooks/session-start.js"'}]},
            {'matcher': 'compact', 'hooks': [{'type': 'command', 'command': 'echo personal-compact'}]},
            {'matcher': 'resume', 'hooks': [
                {'type': 'command', 'command': 'node /project/personal/session-start.js'},
                {'type': 'command', 'command': 'echo "session-start.js check"'}]}]
        hooks['PostCompact'] = [{'hooks': [
            {'type': 'command', 'command': 'node "$HOME/.claude/scripts/hooks/post-compact-memory-reload.js"'},
            {'type': 'command', 'command': 'echo personal-post'}]}]
        hooks['PostToolUse'] = [{'matcher': 'Bash', 'hooks': [
            {'type': 'command', 'command': context.LEGACY_PR_ECHO_COMMAND},
            {'type': 'command', 'command': 'echo "gh pr create; console.log(d)"'},
            {'type': 'command', 'command': 'echo personal-bash'}]}]
        (self.home / 'settings.json').write_text(json.dumps(self.settings), encoding="utf-8")
        before = snapshot(self.home)
        context.apply(self.home, 'claude')
        actual = json.loads((self.home / 'settings.json').read_text(encoding="utf-8"))['hooks']
        startup = [g for g in actual['SessionStart'] if any(
            context.council_hook(h['command'], self.home) and 'session-start.js' in h['command']
            for h in g['hooks'])]
        self.assertEqual(len(startup), 1)
        self.assertNotIn('compact', startup[0]['matcher'])
        compact = [h for g in actual['SessionStart'] if g.get('matcher') == 'compact'
                   for h in g['hooks'] if 'post-compact-memory-reload.js' in h['command']]
        self.assertEqual(len(compact), 1)
        self.assertEqual(actual['PostCompact'][0]['hooks'], [{'type': 'command', 'command': 'echo personal-post'}])
        self.assertIn('echo personal-bash', [h['command'] for g in actual['PostToolUse'] for h in g['hooks']])
        commands = [h['command'] for groups in actual.values() for g in groups for h in g['hooks']]
        self.assertNotIn(context.LEGACY_PR_ECHO_COMMAND, commands)
        for command in ('node /project/personal/session-start.js', 'echo "session-start.js check"',
                        'echo "gh pr create; console.log(d)"'):
            self.assertIn(command, commands)
        for name in context.LIFECYCLE_FILES:
            self.assertTrue((self.home / name).is_file())
        context.apply(self.home, 'claude', restore=True)
        self.assertEqual(snapshot(self.home), before)

    def test_compact_discovery_preserves_custom_skill_body_and_restores_original(self):
        skill = self.home / 'skills/python-patterns/SKILL.md'
        skill.parent.mkdir(parents=True)
        original = '---\nname: python-patterns\ndescription: Personal extension\n---\n\nKeep my custom guidance.\n'
        skill.write_text(original, encoding="utf-8")
        before = snapshot(self.home)
        context.apply(self.home, 'claude')
        self.assertIn('disable-model-invocation: true', skill.read_text(encoding="utf-8"))
        self.assertIn('Keep my custom guidance.', skill.read_text(encoding="utf-8"))
        self.assertNotIn('disable-model-invocation: true', (self.home / 'skills/council/SKILL.md').read_text(encoding="utf-8"))
        installed = snapshot(self.home)
        context.apply(self.home, 'claude')
        self.assertEqual(snapshot(self.home), installed)
        context.apply(self.home, 'claude', restore=True)
        self.assertEqual(snapshot(self.home), before)

    def test_existing_guard_collision_preserves_everything(self):
        guard = self.home / 'scripts/hooks/go-discard-mutations.js'
        guard.parent.mkdir(parents=True)
        guard.write_text('Personal guard implementation', encoding="utf-8")
        before = snapshot(self.home)
        with self.assertRaisesRegex(ValueError, 'collision'):
            context.apply(self.home, 'claude')
        self.assertEqual(snapshot(self.home), before)

    def test_existing_lifecycle_script_collision_preserves_everything(self):
        script = self.home / 'scripts/hooks/session-start.js'
        script.parent.mkdir(parents=True)
        original = b'Personal session hook implementation\n'
        script.write_bytes(original)
        before = snapshot(self.home)
        with self.assertRaisesRegex(ValueError, 'collision'):
            context.apply(self.home, 'claude')
        self.assertEqual(snapshot(self.home), before)
        with patch.dict(context.LEGACY_LIFECYCLE_HASHES, {
                'scripts/hooks/session-start.js': hashlib.sha256(original).hexdigest()}):
            context.apply(self.home, 'claude')
        self.assertEqual(script.read_bytes(), (ROOT / 'scripts/hooks/session-start.js').read_bytes())
        context.apply(self.home, 'claude', restore=True)
        self.assertEqual(snapshot(self.home), before)

    def test_stop_gate_upgrade_refuses_custom_scripts_and_restores_original(self) -> None:
        """Completion-gate ownership never overwrites a customized installed hook."""
        name = 'scripts/hooks/docs-sync-gate.js'
        script = self.home / name
        script.parent.mkdir(parents=True)
        original = b'Personal completion hook implementation\n'
        self.assertEqual(script.write_bytes(original), len(original))
        before = snapshot(self.home)
        with self.assertRaisesRegex(ValueError, 'collision'):
            context.apply(self.home, 'claude')
        self.assertEqual(snapshot(self.home), before)
        with patch.dict(context.LEGACY_LIFECYCLE_HASHES, {
                name: hashlib.sha256(original).hexdigest()}):
            context.apply(self.home, 'claude')
        self.assertEqual(script.read_bytes(), (ROOT / name).read_bytes())
        installed = snapshot(self.home)
        context.apply(self.home, 'claude')
        self.assertEqual(snapshot(self.home), installed)
        context.apply(self.home, 'claude', restore=True)
        self.assertEqual(snapshot(self.home), before)

    def test_frontmatter_updates_are_stable_and_preserve_newlines(self):
        for newline in ('\n', '\r\n'):
            for field in ('', 'disable-model-invocation: false' + newline,
                          'disable-model-invocation: true' + newline):
                original = newline.join(('---', 'name: custom', 'description: Kept')) + newline
                original += field + '---' + newline + newline + 'Exact body' + newline
                compact = context.compact_entrypoint(original)
                self.assertEqual(context.compact_entrypoint(compact), compact)
                self.assertTrue(compact.endswith(newline + newline + 'Exact body' + newline))
                self.assertEqual(compact.count('disable-model-invocation:'), 1)
                if newline == '\r\n':
                    self.assertNotIn('\n', compact.replace('\r\n', ''))

    def test_multiline_skill_flag_refused_without_mutation(self):
        skill = self.home / 'skills/python-patterns/SKILL.md'
        skill.parent.mkdir(parents=True)
        skill.write_text('---\nname: custom\ndisable-model-invocation:\n  false\n---\nBody\n', encoding="utf-8")
        before = snapshot(self.home)
        with self.assertRaisesRegex(ValueError, 'python-patterns/SKILL.md: Unsupported'):
            context.apply(self.home, 'claude')
        self.assertEqual(snapshot(self.home), before)

    def test_codex_config_parse_preservation_and_restore(self):
        context.apply(self.home, 'codex')
        text = (self.home / 'config.toml').read_text(encoding="utf-8")
        actual = tomllib.loads(text)
        original = tomllib.loads(self.before['config.toml'].decode())
        self.assertEqual(actual['model'], original['model'])
        self.assertEqual(actual['model_reasoning_effort'], 'high')
        self.assertEqual(actual['mcp_servers'], original['mcp_servers'])
        self.assertIn('# personal comment', text)
        self.assertEqual(actual['model_auto_compact_token_limit'], 100000)
        self.assertEqual(actual['agents'], {'max_threads': 1, 'max_depth': 2,
                                          'max_concurrent_threads_per_session': 1})
        context.apply(self.home, 'codex', restore=True)
        self.assertEqual(snapshot(self.home), self.before)

    def test_dry_run_and_conflict_do_not_mutate(self):
        context.apply(self.home, 'claude', dry_run=True)
        self.assertEqual(snapshot(self.home), self.before)
        context.apply(self.home, 'claude')
        installed = snapshot(self.home)
        context.apply(self.home, 'claude', dry_run=True, restore=True)
        self.assertEqual(snapshot(self.home), installed)
        (self.home / 'CLAUDE.md').write_text('Changed after migration', encoding="utf-8")
        changed = snapshot(self.home)
        for restore in (False, True):
            with self.assertRaisesRegex(ValueError, 'changed'):
                context.apply(self.home, 'claude', restore=restore)
        self.assertEqual(snapshot(self.home), changed)

    def test_handled_failure_rolls_back(self):
        real = context.core.atomic_write
        fired = False
        def fail_once(path, content, mode):
            nonlocal fired
            if path.name == context.MANIFEST and not fired:
                fired = True
                raise OSError('injected late failure')
            return real(path, content, mode)
        with (patch.object(context.core, 'atomic_write', side_effect=fail_once),
              self.assertRaisesRegex(OSError, 'injected')):
            context.apply(self.home, 'claude')
        self.assertEqual(snapshot(self.home), self.before)

    def test_manifest_rejects_arbitrary_files_and_bad_shapes(self):
        path = self.home / context.MANIFEST
        cases = [[], {'version': 1, 'kind': 'codex', 'files': {'config.toml': None}},
                 {'version': 1, 'kind': 'claude', 'files': {}},
                 {'version': 1, 'kind': 'codex', 'files': {'settings.json': {
                     'sha256': hashlib.sha256(self.before['settings.json']).hexdigest(),
                     'original': base64.b64encode(b'overwritten').decode()}}}]
        for value in cases:
            path.write_text(json.dumps(value), encoding="utf-8")
            before = snapshot(self.home)
            with self.assertRaises(ValueError):
                context.apply(self.home, 'codex', restore=True)
            self.assertEqual(snapshot(self.home), before)

    def test_inline_agents_refused_without_changes(self):
        (self.home / 'config.toml').write_text('agents = { max_depth = 2 }\n', encoding="utf-8")
        before = snapshot(self.home)
        with self.assertRaisesRegex(ValueError, 'standard'):
            context.apply(self.home, 'codex')
        self.assertEqual(snapshot(self.home), before)

    def test_exclusive_lock(self):
        (self.home / '.council-context.lock').mkdir()
        with self.assertRaises(FileExistsError):
            context.apply(self.home, 'codex')
        self.assertEqual(snapshot(self.home), self.before)

    @unittest.skipIf(os.name == 'nt', 'POSIX permissions and symlinks')
    def test_private_backups_and_symlink_refusal(self):
        context.apply(self.home, 'codex')
        self.assertEqual((self.home / context.MANIFEST).stat().st_mode & 0o777, 0o600)
        context.apply(self.home, 'codex', restore=True)
        outside = self.home / 'outside'
        outside.write_text('private', encoding="utf-8")
        (self.home / 'config.toml').unlink()
        (self.home / 'config.toml').symlink_to(outside)
        with self.assertRaisesRegex(ValueError, 'symlink'):
            context.apply(self.home, 'codex')
        self.assertEqual(outside.read_text(encoding="utf-8"), 'private')


if __name__ == '__main__':
    unittest.main()
