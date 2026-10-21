#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# holdem_coin :: UI-Only Aider Pipeline Worker
# ─────────────────────────────────────────────────────────────────────────────
# Orchestrates the full UI-only loop:
#
#   [1] ensure we are NOT on main/master  → switch to ui-updates
#   [2] invoke aider with UI-only profile (reads .aiderignore.ui boundary)
#   [3] run validate_ui.mjs (build + CSS/Tailwind checks — NO backend sim)
#   [4] auto commit & push to ui-updates branch
#
# Hard rules:
#   ✗ NEVER pushes to main or master
#   ✗ NEVER touches src/server, src/lib/poker-*, src/lib/game/**
#   ✗ NEVER runs backend / bot simulations
#
# Usage:
#   npm run ai-ui                                # interactive aider
#   npm run ai-ui -- src/ui/Table/HoldemTable.tsx
#   npm run ai-ui -- --message "polish chip stack animation" src/ui/Chip/
#
# Env overrides:
#   AI_UI_BRANCH      (default: ui-updates)   branch to commit & push to
#   AI_UI_REMOTE      (default: origin)       git remote to push to
#   AI_UI_AIDER       (default: aider)        aider binary path
#   AI_UI_NO_PUSH=1                            skip the final git push
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── config ───────────────────────────────────────────────────────────────────
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BRANCH="${AI_UI_BRANCH:-ui-updates}"
REMOTE="${AI_UI_REMOTE:-origin}"
AIDER_BIN="${AI_UI_AIDER:-aider}"
NO_PUSH="${AI_UI_NO_PUSH:-0}"

# UI-only file scope (used for `git add` after aider patches).
# KEEP THIS LIST ALIGNED WITH .aider.ui.conf.yml / .aiderignore.ui whitelist.
UI_PATHS=(
  "src/ui"
  "public"
  "styles"
  "index.html"
  "tailwind.config.js" "tailwind.config.ts" "tailwind.config.cjs" "tailwind.config.mjs"
  "postcss.config.js" "postcss.config.ts" "postcss.config.cjs" "postcss.config.mjs"
  "vite.config.js" "vite.config.ts"
  "components.json"
  "CONVENTIONS_UI.md"
)

# ── helpers ──────────────────────────────────────────────────────────────────
c_red()    { printf "\033[31m%s\033[0m\n" "$*"; }
c_green()  { printf "\033[32m%s\033[0m\n" "$*"; }
c_yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
c_blue()   { printf "\033[34m%s\033[0m\n" "$*"; }

die() { c_red "[ai-ui] ERROR: $*" >&2; exit 1; }
info() { c_blue "[ai-ui] $*"; }
ok()   { c_green "[ai-ui] ✓ $*"; }
warn() { c_yellow "[ai-ui] WARN: $*"; }

# ── 0. sanity checks ─────────────────────────────────────────────────────────
command -v git >/dev/null     || die "git not found"
command -v "$AIDER_BIN" >/dev/null || die "aider binary '$AIDER_BIN' not found in PATH"
command -v node >/dev/null    || die "node not found"
[ -f .aider.ui.conf.yml ]     || die ".aider.ui.conf.yml missing at $ROOT"
[ -f .aiderignore.ui ]        || die ".aiderignore.ui missing at $ROOT"
[ -f scripts/validate_ui.mjs ] || die "scripts/validate_ui.mjs missing at $ROOT"

# ── 1. branch management — NEVER commit to main/master ─────────────────────
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$CURRENT_BRANCH" = "main" ] || [ "$CURRENT_BRANCH" = "master" ]; then
  info "currently on $CURRENT_BRANCH — refusing to operate. switching to $BRANCH."
  # fetch & checkout existing, or create new
  if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
    git checkout "$BRANCH"
  elif git ls-remote --exit-code --heads "$REMOTE" "$BRANCH" >/dev/null 2>&1; then
    git fetch "$REMOTE" "$BRANCH"
    git checkout -b "$BRANCH" "refs/remotes/$REMOTE/$BRANCH"
  else
    git checkout -b "$BRANCH"
  fi
fi

# Even if not on main/master, double-check we are on the UI branch
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
  info "currently on '$CURRENT_BRANCH' — switching to '$BRANCH'."
  if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
    git checkout "$BRANCH"
  else
    git checkout -b "$BRANCH"
  fi
fi
ok "operating on branch '$BRANCH'"

# ── 2. invoke aider (UI-only profile) ───────────────────────────────────────
info "starting aider with UI-only profile"
# Aider args from `npm run ai-ui -- ...` are forwarded via "$@".
# .aiderignore.ui enforces the hard boundary — backend files are unreachable.
"$AIDER_BIN" \
  --config .aider.ui.conf.yml \
  --aiderignore .aiderignore.ui \
  --no-auto-commits \
  --no-dirty-commits \
  --no-auto-test \
  --message-prefix "[ui-only] " \
  "$@"

AIDER_EXIT=$?
if [ "$AIDER_EXIT" -ne 0 ]; then
  die "aider exited with code $AIDER_EXIT — aborting pipeline before any commit."
fi
ok "aider completed"

# ── 3. validate (build + CSS/Tailwind only — NO backend sim) ────────────────
info "running UI-only validation"
node scripts/validate_ui.mjs
VALIDATE_EXIT=$?
if [ "$VALIDATE_EXIT" -ne 0 ]; then
  die "validate_ui failed (exit=$VALIDATE_EXIT) — refusing to commit. Fix and re-run."
fi
ok "validation passed"

# ── 4. commit & push to ui-updates ───────────────────────────────────────────
# Stage only UI-scoped paths — even if aider accidentally wrote elsewhere,
# we won't include it in the commit.
STAGED=()
for p in "${UI_PATHS[@]}"; do
  # skip if path doesn't exist (avoids `git add` errors on missing files)
  [ -e "$p" ] && STAGED+=("$p")
done

if [ "${#STAGED[@]}" -eq 0 ]; then
  warn "no UI paths exist in repo — nothing to stage."
  exit 0
fi

# `git add` returns non-zero if nothing changed; we tolerate that.
git add -- "${STAGED[@]}" || true

if git diff --cached --quiet; then
  warn "no staged UI changes — skipping commit & push."
  exit 0
fi

COMMIT_MSG="ai-ui: UI updates @ $(date -u +%Y-%m-%dT%H:%M:%SZ)"
git commit -m "$COMMIT_MSG" -- "${STAGED[@]}" >/dev/null
ok "committed → $COMMIT_MSG"

# Final safety: never push from main/master
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$CURRENT_BRANCH" = "main" ] || [ "$CURRENT_BRANCH" = "master" ]; then
  die "internal error: branch switched back to '$CURRENT_BRANCH' — refusing to push."
fi

if [ "$NO_PUSH" = "1" ]; then
  warn "AI_UI_NO_PUSH=1 — skipping git push."
  exit 0
fi

info "pushing $BRANCH to $REMOTE"
if git push -u "$REMOTE" "$BRANCH"; then
  ok "pushed → $REMOTE/$BRANCH"
else
  die "git push failed — your commit is local on '$BRANCH'. Push manually."
fi

ok "UI-only pipeline complete. PR target: $BRANCH → main"
