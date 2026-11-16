#!/usr/bin/env bash
# Build a publishable Council distribution: the AUTHORED corpus only, with an
# installer that recreates the per-agent wiring on any machine (paths are ~-based
# by convention, so nothing personal ships). Vendored skill packs are excluded —
# consumers install those from their upstreams (the installer prints the list).
set -euo pipefail

SRC="$HOME/.claude"
DIST="${1:-$HOME/council-dist}"
# Refuse to destroy a directory this script did not build (review M8): a
# marker file proves prior builds; --force overrides for a first adoption.
if [ -d "$DIST" ] && [ ! -f "$DIST/.council-dist" ] && [ "${2:-}" != "--force" ]; then
  echo "refusing: $DIST exists and is not a council dist (pass --force to adopt)" >&2
  exit 1
fi
# Preserve an existing repo history across rebuilds; a trap restores .git if
# the build is interrupted between the move-out and move-back.
GITDIR=""
restore_git() { if [ -n "$GITDIR" ] && [ -d "$GITDIR" ]; then mkdir -p "$DIST"; mv "$GITDIR" "$DIST/.git"; fi; }
trap restore_git EXIT
if [ -d "$DIST/.git" ]; then
  GITDIR="$(mktemp -d)/dotgit"
  mv "$DIST/.git" "$GITDIR"
fi
rm -rf "$DIST"
mkdir -p "$DIST"
restore_git
GITDIR=""
trap - EXIT
touch "$DIST/.council-dist"

# Vendored skills (mirrors the markdownlint ignores — single source of truth is
# .markdownlint-cli2.jsonc; keep in sync when adding imports).
VENDORED="taste-skill frontend-design canvas-design brand-guidelines theme-factory
algorithmic-art animate animate-expo animation-performance animation-vocabulary
apple-design break-ui choreograph emil-design-eng gestures
find-animation-opportunities improve-animations mobile-native remove-animations
prototype pick-ui-library review-animations learn-taste hypit security-audit
brainstorming writing-skills brag graphify synced .trash"

copy_tree() { mkdir -p "$DIST/$1" && cp -R "$SRC/$1/." "$DIST/$1/"; }
copy_tree rules
copy_tree rules-library
copy_tree commands
mkdir -p "$DIST/skills" "$DIST/agents"
for d in "$SRC"/skills/*/; do
  n="$(basename "$d")"
  case " $VENDORED " in *" $n "*) continue;; esac
  case "$n" in firecrawl*) continue;; esac
  cp -R "$d" "$DIST/skills/$n"
done
for f in "$SRC"/agents/*.md; do
  case "$(basename "$f")" in council-*) continue;; esac   # Roast Room seats need ~/roast-room
  cp "$f" "$DIST/agents/"
done
mkdir -p "$DIST/scripts" && cp -R "$SRC/scripts/hooks" "$DIST/scripts/hooks"
cp "$SRC/scripts/council-record-proof.sh" "$SRC/scripts/code-graph-validate.sh" "$DIST/scripts/" || echo "warn: optional script missing" >&2
cp "$SRC/.markdownlint-cli2.jsonc" "$DIST/"
cp "$SRC/CLAUDE.md" "$DIST/CLAUDE.md.example"   # owner policy as a template, not imposed

cat > "$DIST/install.sh" <<'INSTALL'
#!/usr/bin/env bash
# Council installer: copies the corpus into ~/.claude and symlinks skills into
# every detected agent home. Re-runnable; never overwrites an existing CLAUDE.md.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/.claude"
mkdir -p "$DEST"
for d in rules rules-library skills agents commands scripts hooks; do
  mkdir -p "$DEST/$d" && cp -R "$HERE/$d/." "$DEST/$d/"
done
cp -n "$HERE/.markdownlint-cli2.jsonc" "$DEST/" || echo "warn: optional script missing" >&2
[ -f "$DEST/CLAUDE.md" ] || cp "$HERE/CLAUDE.md.example" "$DEST/CLAUDE.md"
# Cross-agent skill symlinks (Codex, Copilot, and the shared ~/.agents dir)
for home in "$HOME/.codex/skills" "$HOME/.agents/skills" "$HOME/.copilot/skills" "$HOME/.grok/skills"; do
  [ -d "$(dirname "$home")" ] || continue
  mkdir -p "$home"
  for s in "$DEST"/skills/*/; do
    ln -sfn "${s%/}" "$home/$(basename "$s")"
  done
done
# Hooks need registration: ship the hooks/env blocks as a template the user
# merges (never overwrite an existing settings.json).
[ -f "$DEST/settings.json" ] || cp "$HERE/settings.hooks.json" "$DEST/settings.json"
[ -f "$DEST/settings.json" ] && [ -f "$HERE/settings.hooks.json" ] && echo "If settings.json pre-existed, merge hooks/env from settings.hooks.json."
echo "Council installed to $DEST (skills symlinked into detected agent homes)."
echo "Vendored packs are NOT bundled — install from upstream as wanted:"
echo "  anthropics/skills (design five), Leonxlnx/taste-skill, emilkowalski/skills,"
echo "  pbakaus/impeccable (plugin), firecrawl/skills, hypit-ai/hypit,"
echo "  cloudflare/security-audit-skill, nateherkai/roast-room (Founder Board seats)."
INSTALL
chmod +x "$DIST/install.sh"

cp "$SRC/scripts/council-readme.md" "$DIST/README.md"
cp "$SRC/scripts/council-settings-template.json" "$DIST/settings.hooks.json"
mkdir -p "$DIST/hooks" && cp "$SRC/hooks/improve-prompt.py" "$DIST/hooks/"

COUNT_S=$(ls "$DIST/skills" | wc -l | tr -d ' ')
COUNT_A=$(ls "$DIST/agents" | wc -l | tr -d ' ')
echo "dist built at $DIST: $COUNT_S skills, $COUNT_A agents"
