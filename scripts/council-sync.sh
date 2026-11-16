#!/usr/bin/env bash
# Council propagation (the council-multi-agent-propagation convention, scripted):
#  1. ~/.claude (canonical) -> ~/.codex/council/resources mirror, with manifest
#     sha256 re-hash and dead-entry pruning.
#  2. Skill symlink parity across ~/.codex/skills, ~/.agents/skills, ~/.copilot/skills.
# Idempotent; run after any Council mutation. Prints a one-line summary per step.
set -euo pipefail

SRC="$HOME/.claude"
CODEX="$HOME/.codex/council"

# Native installs also own generated roles, hooks and rollback records. Only
# their installer can update that graph without undoing path adaptations.
if python3 - "$CODEX/manifest.json" <<'PY'
import json
import sys
from pathlib import Path

manifest = Path(sys.argv[1])
value = json.loads(manifest.read_text()) if manifest.exists() else {}
sys.exit(0 if 'skill_profile' in value else 1)
PY
then
  root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  if [ ! -f "$root/bootstrap/codex.py" ]; then
    echo 'Native Council sync must run from the Council checkout; use its bootstrap.codex installer.' >&2
    exit 1
  fi
  (cd "$root" && python3 -m bootstrap.codex install --home "$HOME/.codex")
  exit 0
fi

python3 - "$SRC" "$CODEX" <<'EOF'
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

linked=0
for home in "$HOME/.codex/skills" "$HOME/.agents/skills" "$HOME/.copilot/skills" "$HOME/.grok/skills"; do
  [ -d "$(dirname "$home")" ] || continue
  mkdir -p "$home"
  for s in "$SRC"/skills/*/; do
    n="$(basename "$s")"
    case "$n" in synced|.trash|learned|project-guidelines-example) continue;; esac
    [ -e "$home/$n" ] || { ln -sfn "${s%/}" "$home/$n"; linked=$((linked+1)); }
  done
done
echo "symlink parity: $linked new links"

broken=0
for home in "$HOME/.codex/skills" "$HOME/.agents/skills" "$HOME/.copilot/skills" "$HOME/.grok/skills"; do
  [ -d "$home" ] || continue
  for l in "$home"/*; do
    [ -L "$l" ] && [ ! -e "$l" ] && { echo "BROKEN: $l"; broken=$((broken+1)); }
  done
done
echo "broken symlinks: $broken"
[ "$broken" -eq 0 ]
