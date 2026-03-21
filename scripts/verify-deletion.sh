#!/usr/bin/env bash
# =============================================================================
# verify-deletion.sh — Nuclear symbol eradication check
#
# Usage:
#   ./scripts/verify-deletion.sh "Symbol1" "Symbol2" "someFunction" ...
#
# Searches EVERY file in the project (all types, including dist/, .d.ts,
# .snap, .md, .json, comments, and string literals) for any trace of each
# symbol. Exits 1 if anything is found. Exits 0 only when every symbol
# is completely gone from every file in the entire project.
#
# The ONLY directories excluded: .git  node_modules  .worktrees  .pnpm-store
# =============================================================================

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ $# -eq 0 ]; then
  echo "Usage: $0 \"Symbol1\" \"Symbol2\" ..."
  echo "Example: $0 \"appendContentToFile\" \"FileOrganizerSettings\" \"organizer-tab\""
  exit 1
fi

symbols=("$@")
found_any=0

echo ""
echo "============================================================"
echo " DELETION VERIFICATION — searching entire project"
echo " Root: $PROJECT_ROOT"
echo " Symbols: ${#symbols[@]}"
echo "============================================================"
echo ""

for sym in "${symbols[@]}"; do
  # grep across ALL file types — no extension filter
  # This catches: .ts .tsx .js .jsx .mjs .cjs .json .md .yaml .yml
  #               .snap .d.ts .css .html .sh .txt .toml .config and more
  matches=$(grep -rn \
    --exclude-dir=".git" \
    --exclude-dir="node_modules" \
    --exclude-dir=".worktrees" \
    --exclude-dir=".pnpm-store" \
    --exclude="verify-deletion.sh" \
    "$sym" \
    "$PROJECT_ROOT" \
    2>/dev/null || true)

  if [ -n "$matches" ]; then
    echo "❌  FAIL: \"$sym\""
    echo "$matches" | sed 's/^/     /'
    echo ""
    found_any=1
  else
    echo "✅  PASS: \"$sym\""
  fi
done

echo ""
echo "============================================================"
if [ "$found_any" -eq 1 ]; then
  echo " RESULT: FAILED — symbols still present somewhere in the project"
  echo " Fix every line above, then re-run this script."
  echo "============================================================"
  exit 1
else
  echo " RESULT: PASSED — zero traces found across entire project"
  echo "============================================================"
fi
