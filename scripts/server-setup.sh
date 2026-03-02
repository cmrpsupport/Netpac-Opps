#!/usr/bin/env bash
#
# One-time server setup: install Node.js LTS (if missing) then run install-and-run.sh.
# Use on a fresh Ubuntu/Debian server. Run from project root:
#   bash scripts/server-setup.sh
#
set -e
cd "$(dirname "$0")/.."
ROOT="$(pwd)"

echo "=== Netpac Opps – server setup ==="
echo ""

# --- Install Node.js if missing (Ubuntu/Debian) ---
if ! command -v node &>/dev/null; then
    echo "Node.js not found. Installing Node.js LTS..."
    if command -v apt-get &>/dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
        sudo apt-get install -y nodejs
        echo "[OK] Node.js installed via NodeSource"
    else
        echo "Could not install Node.js automatically (no apt-get)."
        echo "Install Node.js LTS from https://nodejs.org/ then run: ./scripts/install-and-run.sh"
        exit 1
    fi
else
    echo "[OK] Node.js already installed: $(node -v)"
fi

# --- Run install and start app ---
echo ""
exec bash "$ROOT/scripts/install-and-run.sh"
