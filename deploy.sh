#!/usr/bin/env bash
#
# Orbit — one-shot deploy script for Ubuntu 22.04 (ARM/aarch64) on Oracle Cloud.
#
# What it does:
#   1. Installs system packages, Node.js 20 and PM2
#   2. Installs project dependencies (rebuilding native better-sqlite3)
#   3. Verifies a .env file exists (with the required secrets)
#   4. Deploys slash commands to Discord
#   5. Starts the bot + website under PM2 and enables boot-start
#
# Usage (run from the project root on the server):
#   chmod +x deploy.sh
#   ./deploy.sh
#
# Re-run any time to update: it pulls latest, reinstalls deps and reloads PM2.

set -euo pipefail

# ---- pretty output -------------------------------------------------
GREEN="\033[0;32m"; YELLOW="\033[1;33m"; RED="\033[0;31m"; NC="\033[0m"
info()  { echo -e "${GREEN}==>${NC} $*"; }
warn()  { echo -e "${YELLOW}!! ${NC} $*"; }
fail()  { echo -e "${RED}xx ${NC} $*"; exit 1; }

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"
info "Project directory: $PROJECT_DIR"

# ---- 1. system dependencies ---------------------------------------
if ! command -v node >/dev/null 2>&1; then
    info "Installing system packages + Node.js 20..."
    sudo apt update
    sudo apt install -y git curl wget unzip build-essential
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
else
    info "Node.js already installed: $(node -v)"
fi

if ! command -v pm2 >/dev/null 2>&1; then
    info "Installing PM2 globally..."
    sudo npm install -g pm2
else
    info "PM2 already installed: $(pm2 -v)"
fi

# ---- 2. pull latest code (if this is a git repo) ------------------
if [ -d .git ]; then
    info "Pulling latest code..."
    git pull --ff-only || warn "git pull skipped (local changes or no upstream)."
fi

# ---- 3. install dependencies --------------------------------------
info "Installing npm dependencies..."
npm install --omit=dev

info "Rebuilding native modules for this CPU (libsql)..."
npm rebuild libsql || warn "libsql rebuild reported an issue — check logs if the bot fails to start."

# ---- 4. environment file ------------------------------------------
if [ ! -f .env ]; then
    warn ".env not found — creating a template. EDIT IT before the bot can run."
    cat > .env <<'EOF'
TOKEN=
CLIENT_ID=
GUILD_ID=
CLIENT_SECRET=
SESSION_SECRET=
WEB_BASE_URL=http://localhost:3000
WEB_PORT=3000
OAUTH_REDIRECT_URI=http://localhost:3000/auth/callback
LOGO_URL=
BANNER_URL=
EOF
    chmod 600 .env
    fail "Fill in .env (at minimum TOKEN and CLIENT_ID), then re-run ./deploy.sh"
fi
chmod 600 .env
info ".env present and locked down (chmod 600)."

# quick sanity check for the essentials
if ! grep -q '^TOKEN=.\+' .env; then
    fail "TOKEN is empty in .env — the bot cannot log in. Fill it in and re-run."
fi

mkdir -p logs

# ---- 5. deploy slash commands -------------------------------------
info "Deploying slash commands to Discord..."
node deploy-commands.js || warn "Command deploy failed — check TOKEN/CLIENT_ID. Continuing."

# ---- 6. start under PM2 -------------------------------------------
info "Starting processes with PM2..."
pm2 start ecosystem.config.js
pm2 save

# enable boot-start (idempotent)
info "Enabling start-on-reboot..."
STARTUP_CMD="$(pm2 startup systemd -u "$USER" --hp "$HOME" | grep 'sudo env' || true)"
if [ -n "$STARTUP_CMD" ]; then
    eval "$STARTUP_CMD" || warn "Could not auto-enable startup; run the printed 'pm2 startup' command manually."
    pm2 save
fi

info "Done! Orbit is live."
echo ""
pm2 list
echo ""
info "Useful next steps:"
echo "    pm2 logs orbit          # watch bot logs"
echo "    pm2 logs orbit-web      # watch website logs"
echo "    pm2 restart all         # restart everything after changes"
