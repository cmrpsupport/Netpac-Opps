#!/bin/bash
# oppX server install script (Linux / macOS)
set -e
cd "$(dirname "$0")/.."
echo "========================================"
echo "  oppX - Server install"
echo "========================================"
echo ""

if ! command -v node &>/dev/null; then
  echo "[ERROR] Node.js not found. Install from https://nodejs.org/ or use nvm."
  exit 1
fi

echo "[1/4] Node version: $(node -v)"
echo ""

echo "[2/4] Installing dependencies..."
npm install
echo ""

if [ ! -f .env ]; then
  echo "[3/4] Creating .env from .env.example..."
  cp .env.example .env
  echo "Edit .env and set JWT_SECRET, USE_SQLITE_LOCAL=1, etc."
else
  echo "[3/4] .env exists, skipping."
fi
echo ""

echo "[4/4] Initialize local database? (y/N)"
read -r INIT_DB
if [[ "$INIT_DB" =~ ^[yY] ]]; then
  npm run db:init
fi
echo ""

echo "========================================"
echo "  Install complete."
echo "========================================"
echo ""
echo "Start server:  npm start"
echo "Production:    NODE_ENV=production npm start"
echo "With PM2:      pm2 start server.js --name oppx"
echo ""
