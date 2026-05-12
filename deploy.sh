#!/bin/bash
# One-shot deploy script for Reference-guides → Firebase Hosting
# (project: threat-modeling-workbench)
#
# Prerequisites:
#   - Node.js installed (https://nodejs.org/ — LTS is fine)
#   - You are in the root of your local clone of casarezaz/Reference-guides
#   - The new files (firebase.json, .firebaserc, ai-config.js, *-ai.js, ai-field-lab/*.html)
#     are already in place
#
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh

set -e

echo "==> Checking Firebase CLI…"
if ! command -v firebase &> /dev/null; then
  echo "    Installing firebase-tools globally (one-time)…"
  npm install -g firebase-tools
fi

echo "==> Logging into Firebase (browser will open if not already logged in)…"
firebase login --no-localhost

echo "==> Verifying project binding (.firebaserc)…"
firebase use threat-modeling-workbench

echo "==> Deploying to Hosting…"
firebase deploy --only hosting

echo ""
echo "✓ Deploy complete!"
echo "  Visit: https://threat-modeling-workbench.web.app"
echo "  Or:    https://threat-modeling-workbench.firebaseapp.com"
