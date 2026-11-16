#!/usr/bin/env bash
# Synchronize resource mirrors and skill links without replacing owner entries.
set -euo pipefail

SRC="$HOME/.claude"
CODEX="$HOME/.codex/council"
PYTHON="${COUNCIL_PYTHON:-python3}"

# Native installs also own generated roles, hooks and rollback records. Only
# their installer can update that graph without undoing path adaptations.
mode=$("$PYTHON" - "$CODEX/manifest.json" <<'PY'
import json
import sys
from pathlib import Path

manifest = Path(sys.argv[1])
value = json.loads(manifest.read_text()) if manifest.exists() else {}
if not isinstance(value, dict) or not isinstance(value.get('files', {}), dict):
    sys.exit('Invalid Council manifest; preserve it before retrying sync')
native = ('skill_profile' in value or 'source_revision' in value or
          any(not key.startswith('council/resources/') for key in value.get('files', {})))
print('native' if native else 'legacy')
PY
)
if [ "$mode" = native ]; then
  root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  if [ ! -f "$root/bootstrap/codex.py" ]; then
    echo 'Native Council sync must run from the Council checkout; use its bootstrap.codex installer.' >&2
    exit 1
  fi
  (cd "$root" && "$PYTHON" -m bootstrap.codex install --home "$HOME/.codex")
else
"$PYTHON" - "$SRC" "$CODEX" <<'EOF'
import os, sys, shutil, hashlib, json
SRC, CODEX = sys.argv[1], sys.argv[2]
os.chdir(CODEX)
m = json.load(open('manifest.json'))
# Owner-retained files (local: true, written by codex.py --reconcile) are never
# overwritten from canonical, never ghost-deleted, never pruned.
localset = {k[len('council/'):] for k, v in m['files'].items()
            if isinstance(v, dict) and v.get('local')}
copied = pruned = 0
for sub in ['rules', 'rules-library', 'skills', 'agents', 'commands']:
    base = f'resources/{sub}'
    if not os.path.isdir(base):
        continue
    for dp, _, fs in os.walk(base):
        for f in fs:
            rp = os.path.join(dp, f)
            if rp in localset:
                continue
            sp = os.path.join(SRC, os.path.relpath(rp, 'resources'))
            if os.path.exists(sp):
                if open(sp, 'rb').read() != open(rp, 'rb').read():
                    shutil.copy2(sp, rp)
                    copied += 1
                    k = 'council/' + rp
                    m['files'].setdefault(k, {'original': None})['sha256'] = \
                        hashlib.sha256(open(rp, 'rb').read()).hexdigest()
added = 0
# new canonical files missing from the mirror (only within already-mirrored skill/agent dirs)
for sub in ['rules', 'rules-library', 'skills', 'agents', 'commands']:
    sdir = os.path.join(SRC, sub)
    if not os.path.isdir(sdir) or not os.path.isdir(f'resources/{sub}'):
        continue
    for dp, _, fs in os.walk(sdir):
        for f in fs:
            sp = os.path.join(dp, f)
            rel = os.path.relpath(sp, SRC)
            rp = os.path.join('resources', rel)
            # add when the item's TOP-LEVEL dir is mirrored (vendored dirs are not);
            # new subdirs of a mirrored skill are created as needed
            parts = rel.split(os.sep)
            top = os.path.join('resources', *parts[:2]) if len(parts) > 1 else None
            if not os.path.exists(rp) and top and os.path.isdir(top):
                os.makedirs(os.path.dirname(rp), exist_ok=True)
                shutil.copy2(sp, rp)
                added += 1
                k = 'council/' + rp
                m['files'][k] = {'original': None,
                                 'sha256': hashlib.sha256(open(rp, 'rb').read()).hexdigest()}
ghosts = 0
for sub in ['rules', 'rules-library', 'skills', 'agents', 'commands']:
    base = f'resources/{sub}'
    if not os.path.isdir(base):
        continue
    for dp, _, fs in os.walk(base, topdown=False):
        for f in fs:
            rp = os.path.join(dp, f)
            if rp in localset:
                continue
            sp = os.path.join(SRC, os.path.relpath(rp, 'resources'))
            if not os.path.exists(sp):
                os.remove(rp)
                ghosts += 1
        if not os.listdir(dp):
            os.rmdir(dp)
for k in list(m['files']):
    if not k.startswith('council/resources/'):
        continue
    if isinstance(m['files'][k], dict) and m['files'][k].get('local'):
        continue
    p = k[len('council/'):]
    if not os.path.exists(p):
        del m['files'][k]
        pruned += 1
json.dump(m, open('manifest.json', 'w'), indent=2)
print(f'codex mirror: {copied} synced, {added} added, {pruned} dead manifest entries pruned, {ghosts} source-gone mirror files removed')
EOF
fi

# Git Bash may emulate `ln -s` by copying. Native links must track later edits.
"$PYTHON" - "$SRC" "$HOME" "$mode" <<'PYTHON'
import sys
from pathlib import Path

source, owner, mode = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3]
harnesses = ['.agents', '.copilot', '.grok']
if mode == 'legacy':
    harnesses.append('.codex')
linked = 0
for harness in harnesses:
    base = owner / harness
    if not base.is_dir():
        continue
    destination = base / 'skills'
    destination.mkdir(exist_ok=True)
    for skill in sorted((source / 'skills').glob('*/')):
        if skill.name in {'synced', '.trash', 'learned', 'project-guidelines-example'}:
            continue
        link = destination / skill.name
        # Preserve owner entries, including dangling links diagnosed below.
        if link.exists() or link.is_symlink():
            continue
        try:
            link.symlink_to(skill, target_is_directory=True)
        except FileExistsError:
            # Preserve a racing creation.
            continue
        except OSError as error:
            sys.exit(f'Cannot create native skill link {link}: {error}')
        linked += 1
print(f'symlink parity: {linked} new links')

broken = 0
for harness in ['.codex', '.agents', '.copilot', '.grok']:
    for link in (owner / harness / 'skills').glob('*'):
        if link.is_symlink() and not link.exists():
            print(f'BROKEN: {link}')
            broken += 1
print(f'broken symlinks: {broken}')
sys.exit(1 if broken else 0)
PYTHON
