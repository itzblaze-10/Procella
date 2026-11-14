#!/usr/bin/env bash
# One-time per clone: use the tracked hooks in scripts/hooks (auto-push after commit).
set -e
cd "$(git rev-parse --show-toplevel)"
chmod +x scripts/hooks/* scripts/*.sh
git config core.hooksPath scripts/hooks
echo "hooks installed: core.hooksPath = scripts/hooks"
