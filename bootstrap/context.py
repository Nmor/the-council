#!/usr/bin/env python3
"""Apply reversible Council context/cost settings to existing Claude and Codex homes."""
import argparse
import base64
import hashlib
import importlib.util
import json
import re
import shlex
import sys
from pathlib import Path, PurePosixPath

import tomllib

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('council_installer', ROOT / 'bootstrap/codex.py')
core = importlib.util.module_from_spec(spec)
spec.loader.exec_module(core)
MANIFEST = '.council-context.json'
COUNCIL_COMPACT_WINDOW = 100000
LEGACY_PR_ECHO_COMMAND = "node -e \"let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const i=JSON.parse(d);const cmd=i.tool_input?.command||'';if(/gh pr create/.test(cmd)){const out=i.tool_output?.output||'';const m=out.match(/https:\\/\\/github.com\\/[^/]+\\/[^/]+\\/pull\\/\\d+/);if(m){console.error('[Hook] PR created: '+m[0]);const repo=m[0].replace(/https:\\/\\/github.com\\/([^/]+\\/[^/]+)\\/pull\\/\\d+/,'$1');const pr=m[0].replace(/.*\\/pull\\/(\\d+)/,'$1');console.error('[Hook] To review: gh pr review '+pr+' --repo '+repo)}}}catch{}console.log(d)})\""
LIFECYCLE_FILES = (
    'scripts/hooks/session-start.js', 'scripts/hooks/pre-compact.js',
    'scripts/hooks/pre-compact-council-brief.js', 'scripts/hooks/post-compact-memory-reload.js',
    'scripts/hooks/pr-created-notice.js', 'scripts/hooks/lib/lifecycle-context.js',
    'scripts/hooks/lib/project-context.js', 'scripts/hooks/lib/advise.js',
    'scripts/hooks/docs-sync-gate.js',
)
# Exact prior Council versions may be upgraded without claiming unrelated local scripts.
LEGACY_LIFECYCLE_HASHES = {
    'scripts/hooks/session-start.js': '1a66f3841535fc625eba4ca1435486945a032601df8f9f561389a619f65e927b',
    'scripts/hooks/pre-compact.js': 'b4cb0a34056ae4cd7e43619b7954e41efeb47dd6db19fadc87873b3c7a4fcf16',
    'scripts/hooks/pre-compact-council-brief.js': 'b5cf2bd97acb3995d2dbd93eab6cecd0749b3cb3de1768d921e7e481bdde8fcf',
    'scripts/hooks/post-compact-memory-reload.js': '850dc78b53b7eb997ea09cb69dcaed2df8e40f0e44f2d03a322643ca9ddfc9ba',
    'scripts/hooks/docs-sync-gate.js': 'a508c043eca8810f32c1b0043599223b8fd9f8eec86bcd942298a2835a8d8b55',
}


def compact_entrypoint(text: str) -> str:
    """Keep full guidance on disk, but omit skill descriptions from automatic discovery."""
    match = re.match(r'^(---\r?\n)(.*?)(\r?\n---\r?\n)', text, re.DOTALL)
    if not match:
        raise ValueError('Council skill requires YAML frontmatter')
    newline = '\r\n' if match.group(1).endswith('\r\n') else '\n'
    lines = match.group(2).splitlines(keepends=True)
    found = False
    for index, line in enumerate(lines):
        field = re.match(r'^(?:disable-model-invocation|\'disable-model-invocation\'|"disable-model-invocation"):(.*)$',
                         line.rstrip('\r\n'))
        if not field:
            continue
        value = field.group(1).strip()
        continuation = index + 1 < len(lines) and re.match(r'^[ \t]+\S', lines[index + 1])
        if found or continuation or not re.fullmatch(r'(?:true|false)(?:\s+#.*)?', value, re.IGNORECASE):
            raise ValueError('Unsupported disable-model-invocation; use one inline boolean')
        ending = newline if line.endswith('\n') else ''
        lines[index] = 'disable-model-invocation: true' + ending
        found = True
    header = ''.join(lines)
    if not found:
        header += newline + 'disable-model-invocation: true'
    return match.group(1) + header + text[match.end(2):]


def council_hook(command: str, home: Path) -> bool:
    """Recognize only direct Node calls to owned context scripts."""
    managed = ('session-start.js', 'pre-compact.js', 'pre-compact-council-brief.js',
               'post-compact-memory-reload.js', 'pr-created-notice.js',
               'suggest-compact.js')
    try:
        arguments = shlex.split(command)
    except ValueError:
        return False
    if len(arguments) != 2:
        return False
    # Windows homes produce backslash paths; ownership must not depend on them.
    target = arguments[1].replace('\\', '/')
    if arguments[0] == 'python3':
        # The Council prompt injector is the one owned python hook.
        suffix = '/.claude/hooks/improve-prompt.py'
        return target in {f'$HOME{suffix}', f'${{HOME}}{suffix}', f'~{suffix}',
                          str(home / 'hooks/improve-prompt.py').replace('\\', '/')}
    if arguments[0] != 'node':
        return False
    for name in managed:
        suffix = f'/.claude/scripts/hooks/{name}'
        if target in {f'$HOME{suffix}', f'${{HOME}}{suffix}', f'~{suffix}',
                      str(home / 'scripts/hooks' / name).replace('\\', '/')}:
            return True
    return False


def lifecycle_hooks(settings, source_hooks, home):
    """Replace owned context hooks; preserve personal hooks and security gates."""
    hooks_by_event = settings.setdefault('hooks', {})
    events = ('SessionStart', 'PreCompact', 'PostCompact', 'PreToolUse', 'PostToolUse',
              'UserPromptSubmit')
    for event in events:
        retained = []
        for group in hooks_by_event.get(event, []):
            hooks = []
            for hook in group.get('hooks', []):
                command = hook.get('command', '')
                legacy_pr_echo = command == LEGACY_PR_ECHO_COMMAND
                if not legacy_pr_echo and not council_hook(command, home):
                    hooks.append(hook)
            if hooks:
                retained.append({**group, 'hooks': hooks})
        for group in source_hooks.get(event, []):
            hooks = [hook for hook in group.get('hooks', [])
                     if council_hook(hook.get('command', ''), home)]
            if hooks:
                retained.append({**group, 'hooks': hooks})
        if retained or event in hooks_by_event:
            hooks_by_event[event] = retained


def target(home, name):
    relative = PurePosixPath(name)
    if relative.is_absolute() or '..' in relative.parts or '\\' in name:
        raise ValueError(f'Unsafe managed path: {name}')
    path = home / name
    for parent in (path, *path.parents):
        if parent == home.parent:
            break
        if parent.is_symlink():
            raise ValueError(f'Refusing symlink: {parent}')
    if path.exists() and not path.is_file():
        raise ValueError(f'Not a regular file: {path}')
    return path


def claude_payload(home):
    paths = ['CLAUDE.md', 'settings.json', 'scripts/token-budget.mjs', 'scripts/hooks/lib/memory-lint.js']
    paths += [p.relative_to(ROOT).as_posix() for p in (ROOT / 'rules/common').glob('*.md')]
    paths += [p.relative_to(ROOT).as_posix() for p in (ROOT / 'rules-library/council-detail').glob('*.md')]
    paths += ['docs/CONTEXT.md', 'rules-library/common/agents.md',
              'skills/council-rules/references/agent-delegation.md', 'skills/mcp-builder/SKILL.md',
              'skills/council-protocol/SKILL.md', 'skills/iterative-retrieval/SKILL.md']
    paths += [name for name in core.tracked_resources(ROOT)
              if name.startswith(('skills/', 'rules-library/', 'agents/', 'commands/'))]
    paths += [name for name in core.tracked_resources(ROOT)
              if name.startswith('scripts/hooks/lib/') and name.endswith('.js')]
    paths += ['docs/BRAG.md', 'docs/no-discards.md', 'scripts/hooks/go-discard-mutations.js']
    paths += list(LIFECYCLE_FILES)
    paths += [p.relative_to(ROOT).as_posix() for p in (ROOT / 'skills').glob('*/SKILL.md')]
    result = {name: (ROOT / name).read_bytes() for name in paths if name != 'settings.json'}
    for name, content in list(result.items()):
        if name.startswith('skills/') and name.endswith('/SKILL.md') and name != 'skills/council/SKILL.md':
            existing = target(home, name)
            if existing.is_file():
                if name.startswith('skills/brag/'):
                    try:
                        matches = (compact_entrypoint(existing.read_bytes().decode('utf-8')) ==
                                   compact_entrypoint(content.decode('utf-8')))
                    except ValueError as error:
                        raise ValueError(f'Unmanaged Council resource collision: {existing}') from error
                    if not matches:
                        raise ValueError(f'Unmanaged Council resource collision: {existing}')
                content = existing.read_bytes()
            try:
                result[name] = compact_entrypoint(content.decode('utf-8')).encode('utf-8')
            except ValueError as error:
                raise ValueError(f'{name}: {error}') from error
    settings_path = target(home, 'settings.json')
    settings = json.loads((settings_path if settings_path.exists() else ROOT / 'settings.json')
                          .read_text(encoding='utf-8'))
    if not isinstance(settings, dict) or not isinstance(settings.get('env', {}), dict):
        raise TypeError('Claude settings must contain JSON objects')
    settings.update(autoCompactEnabled=True, disableWorkflows=True,
                    workflowSizeGuideline='small')
    if settings.get('autoCompactWindow') == COUNCIL_COMPACT_WINDOW:
        del settings['autoCompactWindow']
    settings.setdefault('enableArtifact', False)
    settings.setdefault('env', {}).pop('autoCompactEnabled', None)  # Not an environment variable.
    settings.setdefault('env', {}).update(CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH='1',
                                         CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY='2')
    # UserPromptSubmit is owned by lifecycle_hooks: legacy injector registrations
    # (any spelling of hooks/improve-prompt.py) are replaced by the canonical slim
    # one, and personal prompt hooks are preserved.
    source_hooks = json.loads((ROOT / 'settings.json').read_text(encoding='utf-8'))['hooks']
    lifecycle_hooks(settings, source_hooks, home)
    guard_name = 'go-discard-mutations.js'
    for event in ('PreToolUse', 'PostToolUse'):
        groups = settings.setdefault('hooks', {}).get(event, [])
        retained = []
        for group in groups:
            hooks = [hook for hook in group.get('hooks', [])
                     if guard_name not in hook.get('command', '')]
            if hooks:
                retained.append({**group, 'hooks': hooks})
        retained.extend(group for group in source_hooks[event]
                        if any(guard_name in hook.get('command', '')
                               for hook in group.get('hooks', [])))
        settings['hooks'][event] = retained
    result['settings.json'] = core.json_bytes(settings)
    return result


def set_toml(text, key, value, section=None):
    """Replace a simple native setting while preserving unrelated TOML text and comments."""
    lines = text.splitlines(keepends=True)
    headers = [(i, line.split('#', 1)[0].strip()) for i, line in enumerate(lines) if re.match(r'^\s*\[', line)]
    if section is None:
        start, end = 0, headers[0][0] if headers else len(lines)
    else:
        found = [i for i, header in headers if header == f'[{section}]']
        if not found:
            return text.rstrip() + f'\n\n[{section}]\n{key} = {value}\n'
        start = found[0] + 1
        end = next((i for i, _ in headers if i >= start), len(lines))
    pattern = re.compile(r'^\s*' + re.escape(key) + r'\s*=')
    for i in range(start, end):
        if pattern.match(lines[i]):
            lines[i] = f'{key} = {value}\n'
            return ''.join(lines)
    lines.insert(start, f'{key} = {value}\n')
    return ''.join(lines)


def codex_payload(home):
    path = target(home, 'config.toml')
    text = path.read_text(encoding='utf-8') if path.exists() else ''
    parsed = tomllib.loads(text)
    agents = parsed.get('agents', {})
    # Inline/dotted agent tables need a real TOML editor; never flatten user settings.
    if agents and not re.search(r'^\s*\[agents\][ \t]*(?:#[^\n]*)?$', text, re.MULTILINE):
        raise ValueError('Use a standard [agents] table before applying the cost profile')
    text = set_toml(text, 'model_auto_compact_token_limit', 100000)
    text = set_toml(text, 'max_concurrent_threads_per_session', 1, 'agents')
    if 'max_threads' in agents:
        text = set_toml(text, 'max_threads', 1, 'agents')
    tomllib.loads(text)
    return {'config.toml': text.encode()}


def _apply(home, kind, dry_run=False, restore=False):
    home = home.expanduser().absolute()
    if not home.is_dir():
        raise ValueError(f'Existing {kind} home required: {home}')
    manifest_path = target(home, MANIFEST)
    old = json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else {'files': {}}
    if (not isinstance(old, dict) or not isinstance(old.get('files'), dict) or
            (manifest_path.exists() and (old.get('version') != 1 or old.get('kind') != kind))):
        raise ValueError('Invalid context migration manifest')
    allowed = {'config.toml'} if kind == 'codex' else set(claude_payload(home))
    for name, entry in old['files'].items():
        if name not in allowed or not isinstance(entry, dict) or not isinstance(entry.get('sha256'), str):
            raise ValueError('Invalid context migration entry')
        if 'original' not in entry:
            raise ValueError('Missing original backup')
        if entry['original'] is not None:
            base64.b64decode(entry['original'], validate=True)
        path = target(home, name)
        if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != entry['sha256']:
            raise ValueError(f'Managed file changed; preserve/reconcile it before retrying: {path}')
    if restore:
        if not old['files']:
            raise ValueError('No context migration to restore')
        payload = {name: base64.b64decode(entry['original']) if entry['original'] is not None else None
                   for name, entry in old['files'].items()}
        payload[MANIFEST] = None
    else:
        payload = claude_payload(home) if kind == 'claude' else codex_payload(home)
        entries = {}
        for name, content in payload.items():
            path = target(home, name)
            protected = ((name.startswith('skills/') and not name.endswith('/SKILL.md')) or
                         name.startswith(('rules-library/', 'agents/', 'commands/', 'skills/brag/',
                                          'scripts/hooks/lib/')) or name in LIFECYCLE_FILES or
                         name in ('scripts/hooks/go-discard-mutations.js', 'skills/council/SKILL.md'))
            if (protected
                    and name not in old['files'] and
                    path.exists() and path.read_bytes() != content):
                # Upgrade an unmodified prior Council hook, never an unrelated local script.
                digest = hashlib.sha256(path.read_bytes()).hexdigest()
                prior_skill = (name == 'skills/brag/SKILL.md' and
                               compact_entrypoint(path.read_bytes().decode('utf-8')).encode('utf-8') == content)
                if not prior_skill and digest != LEGACY_LIFECYCLE_HASHES.get(name):
                    raise ValueError(f'Unmanaged Council resource collision: {path}')
            original = old['files'].get(name, {}).get('original') if name in old['files'] else (
                base64.b64encode(path.read_bytes()).decode() if path.exists() else None)
            entries[name] = {'sha256': hashlib.sha256(content).hexdigest(), 'original': original}
        payload[MANIFEST] = core.json_bytes({'version': 1, 'kind': kind, 'files': entries})
    if not dry_run:
        snapshots = {}
        created = []
        try:
            for name, content in payload.items():
                path = target(home, name)
                snapshots[name] = (path.read_bytes() if path.exists() else None,
                                   path.stat().st_mode & 0o777 if path.exists() else 0o644)
                missing = []
                parent = path.parent
                while not parent.exists():
                    missing.append(parent)
                    parent = parent.parent
                for folder in reversed(missing):
                    folder.mkdir()
                    created.append(folder)
                if content is None:
                    path.unlink(missing_ok=True)
                else:
                    core.atomic_write(path, content, 0o600 if name == MANIFEST else snapshots[name][1])
        except BaseException:
            for name, (content, mode) in reversed(list(snapshots.items())):
                path = home / name
                if content is None:
                    path.unlink(missing_ok=True)
                else:
                    core.atomic_write(path, content, mode)
            for folder in reversed(created):
                folder.rmdir()
            raise
    return {'client': kind, 'files': len(payload) - 1, 'dry_run': dry_run, 'restored': restore}


def apply(home, kind, dry_run=False, restore=False):
    if kind not in ('claude', 'codex'):
        raise ValueError('Unsupported client')
    home = home.expanduser().absolute()
    target(home, MANIFEST)
    lock = home / '.council-context.lock'
    if dry_run:
        return _apply(home, kind, True, restore)
    lock.mkdir()  # Exclusive creation; do not overwrite another migration's lock.
    try:
        return _apply(home, kind, False, restore)
    finally:
        lock.rmdir()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=('apply', 'restore'))
    parser.add_argument('--claude-home', type=Path)
    parser.add_argument('--codex-home', type=Path)
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    if not args.claude_home and not args.codex_home:
        parser.error('Choose --claude-home and/or --codex-home explicitly')
    try:
        for kind, home in [('claude', args.claude_home), ('codex', args.codex_home)]:
            if home:
                print(json.dumps(apply(home, kind, args.dry_run, args.action == 'restore')))
    except (ValueError, OSError, TypeError, KeyError) as error:
        print(f'Council context: {error}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
