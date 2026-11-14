#!/usr/bin/env bash
# Verifies the local folder and GitHub are identical for the current branch.
# Exit 0 = in sync. Non-zero = something is uncommitted, unpushed or behind.
set -u
cd "$(git rev-parse --show-toplevel)" || exit 2
branch=$(git rev-parse --abbrev-ref HEAD)

git fetch origin --quiet || { echo "sync-check: cannot reach origin"; exit 2; }

status=0
if [ -n "$(git status --porcelain)" ]; then
  echo "sync-check: UNCOMMITTED changes:"; git status --short; status=1
fi

if ! git rev-parse --verify --quiet "origin/$branch" >/dev/null; then
  echo "sync-check: branch '$branch' does not exist on origin yet"; exit 1
fi

ahead=$(git rev-list --count "origin/$branch..HEAD")
behind=$(git rev-list --count "HEAD..origin/$branch")
[ "$ahead" -gt 0 ]  && { echo "sync-check: $ahead commit(s) not pushed"; status=1; }
[ "$behind" -gt 0 ] && { echo "sync-check: $behind commit(s) to pull from origin"; status=1; }

[ "$status" -eq 0 ] && echo "sync-check: local == origin/$branch ($(git rev-parse --short HEAD))"
exit "$status"
