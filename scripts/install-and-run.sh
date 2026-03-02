#!/usr/bin/env bash
#
# Install prerequisites and run the app (for server deployment).
# Usage: ./scripts/install-and-run.sh   OR   bash scripts/install-and-run.sh
#

set -e
cd "$(dirname "$0")/.."
ROOT="$(pwd)"

echo "=== Netpac Opps – install and run ==="
echo "Project root: $ROOT"
echo ""

# --- 1. Check Node.js ---
if ! command -v node &>/dev/null; then
    echo "Node.js is not installed."
    echo ""
    echo "Install Node.js (LTS) first, for example:"
    echo "  • Ubuntu/Debian: curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs"
    echo "  • Or use nvm:    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash && nvm install --lts"
    echo "  • macOS:         brew install node"
    echo ""
    exit 1
fi

NODE_VERSION=$(node -v)
echo "[OK] Node.js: $NODE_VERSION"

# --- 2. npm install ---
echo ""
echo "Installing dependencies (npm install)..."
npm install
echo "[OK] Dependencies installed"

# --- 3. .env ---
if [ ! -f .env ]; then
    echo ""
    echo "No .env found. Creating from .env.example..."
    cp .env.example .env
    echo "[OK] .env created. Edit .env to set JWT_SECRET and PORT if needed."
else
    echo ""
    echo "[OK] .env exists"
fi

# --- 4. SQLite database (local) ---
echo ""
echo "Initializing local SQLite database (if needed)..."
if node scripts/init-local-sqlite.js; then
    echo "[OK] Database ready"
else
    echo "[WARN] Database init had warnings or already exists – continuing"
fi

# --- 5. Run server ---
echo ""
echo "Starting server..."
echo "  PORT from .env or default 3000. Stop with Ctrl+C."
echo ""
exec node server.js
