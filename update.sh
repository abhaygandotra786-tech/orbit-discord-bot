#!/usr/bin/env bash
#
# Orbit — update script. Pulls latest code, reinstalls changed deps,
# redeploys slash commands and reloads PM2 with zero downtime.
#
# Usage (on the server, from the project root):
#   ./update.sh

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

echo "==> Pulling latest code..."
git pull --ff-only

echo "==> Installing dependencies..."
npm install --omit=dev

echo "==> Rebuilding native modules..."
npm rebuild libsql || true

echo "==> Redeploying slash commands..."
node deploy-commands.js || echo "!! command deploy failed (check TOKEN/CLIENT_ID)"

echo "==> Reloading PM2 (zero-downtime)..."
pm2 reload ecosystem.config.js
pm2 save

echo "==> Done."
pm2 list
