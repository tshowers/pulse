#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

echo "Running Pulse production hosting deploy"
echo "Firebase project context: taliferrotech"
firebase use taliferrotech

echo "Building the production Pulse bundle..."
npm run build

echo "Deploying Pulse to Firebase Hosting site todd-pulse..."
firebase deploy --project taliferrotech --only hosting:todd-pulse

echo "Pulse hosting deploy complete."
firebase projects:list
