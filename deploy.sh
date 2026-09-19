#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

# The Firestore emulator (used by `npm run e2e` below) needs a JRE. Homebrew's
# openjdk isn't symlinked onto PATH by default, so pick it up here rather than
# requiring that to be done manually on every machine that runs this script.
if command -v brew >/dev/null 2>&1; then
  JAVA_PREFIX="$(brew --prefix openjdk 2>/dev/null || true)"
  if [ -n "${JAVA_PREFIX}" ] && [ -d "${JAVA_PREFIX}/bin" ]; then
    export PATH="${JAVA_PREFIX}/bin:${PATH}"
  fi
fi

# Cypress (used by `npm run e2e` below) is Electron-based. Some shells set
# ELECTRON_RUN_AS_NODE, which forces every Electron binary - Cypress's
# included - into plain-Node mode instead of launching the real app,
# producing a confusing "bad option: --no-sandbox" failure. Unsetting it
# here is a no-op if it was never set.
unset ELECTRON_RUN_AS_NODE || true

# `set -e` already exits on the first failing command, but this makes the
# reason explicit no matter which step below fails.
trap 'echo "Deploy aborted - a previous step failed, nothing was committed or deployed." >&2' ERR

echo "Running Pulse production hosting deploy"
echo "Firebase project context: taliferrotech"
firebase use taliferrotech

echo "Step 1/4: Building the production Pulse bundle..."
npm run build

echo "Step 2/4: Running tests (unit + end-to-end)..."
npm run test:ci
npm run e2e

echo "Step 3/4: Committing changes..."
if [ -n "$(git status --porcelain)" ]; then
  git add -A
  git commit -m "Deploy $(date +'%Y-%m-%d %H:%M:%S')"
else
  echo "No changes to commit - working tree is clean."
fi

echo "Step 4/4: Deploying Pulse to Firebase Hosting site todd-pulse..."
firebase deploy --project taliferrotech --only hosting:todd-pulse

echo "Pulse hosting deploy complete."
firebase projects:list
