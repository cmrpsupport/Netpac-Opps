# oppX - Deployment guide

**Production runs on Render.** See [RENDER_DEPLOYMENT_GUIDE.md](./RENDER_DEPLOYMENT_GUIDE.md) to deploy there. For local or on-prem installs, use the options below.

This app is a **Node.js web application**. There is no single `.exe` installer.

---

## Option 1: One-click style install (Windows, local/on-prem only)

1. **Install Node.js** (required once per machine):
   - Download LTS from https://nodejs.org/
   - Run the installer and ensure "Add to PATH" is checked.

2. **Run the install script**:
   - Double-click `scripts\install-server.bat`  
   - Or open Command Prompt in the project folder and run:
     ```cmd
     scripts\install-server.bat
     ```
   - The script will: `npm install`, create `.env` from `.env.example` if missing, and optionally run `npm run db:init` (local SQLite).

3. **Configure**:
   - Edit `.env`: set `JWT_SECRET`, and `USE_SQLITE_LOCAL=1` if using local SQLite.

4. **Start the server**:
   ```cmd
   npm start
   ```
   App will be at `http://localhost:3000` (or the port in `.env`).

---

## Option 2: Linux / macOS server (VPS, cloud VM)

```bash
# Clone repo (or upload/copy files)
git clone https://github.com/cmrpsupport/Netpac-Opps.git
cd Netpac-Opps

# Run install script
chmod +x scripts/install-server.sh
./scripts/install-server.sh

# Or manually:
npm install
cp .env.example .env
# Edit .env
npm run db:init   # if using local SQLite
NODE_ENV=production npm start
```

**Run in background (recommended):**

```bash
# Using PM2
npm install -g pm2
pm2 start server.js --name oppx
pm2 save && pm2 startup
```

---

## Option 3: Manual steps (any server)

| Step | Command / action |
|------|-------------------|
| 1. Node.js | Install Node 18+ from https://nodejs.org/ |
| 2. Dependencies | `npm install` |
| 3. Environment | Copy `.env.example` to `.env` and set `JWT_SECRET`, `PORT`, `USE_SQLITE_LOCAL=1` (for local DB) |
| 4. Database | For local SQLite: `npm run db:init` |
| 5. Start | `npm start` or `NODE_ENV=production npm start` |

---

## Why there is no .exe

- The app is a **web server** (Express) that runs in Node.js.
- It needs Node.js installed on the server; it is not a single standalone executable.
- The **install scripts** (`install-server.bat` on Windows, `install-server.sh` on Linux/Mac) automate: install deps, create `.env`, optionally init DB. That's the closest to an "auto install."
- To get a **single executable** you'd need to use tools like `pkg` or `nexe` to bundle Node + app (advanced and not required for normal server install).

---

## Production checklist (Render)

- [ ] Deploy on Render - see [RENDER_DEPLOYMENT_GUIDE.md](./RENDER_DEPLOYMENT_GUIDE.md)
- [ ] Set `SQLITECLOUD_URL` in Render Environment (your SQLite Cloud connection URL)
- [ ] Set `NODE_ENV=production` and a strong `JWT_SECRET` in Render Environment
- [ ] Set `FRONTEND_URL` to your frontend origin (for CORS)
- [ ] Build: `npm install`; Start: `node server.js`. Run `npm run db:init-cloud` once to apply schema to SQLite Cloud.

---

## Quick reference

| Task        | Command / file                |
|------------|-------------------------------|
| Install    | `scripts\install-server.bat` (Windows) or `./scripts/install-server.sh` (Linux/Mac) |
| Init DB    | `npm run db:init`             |
| Start      | `npm start`                   |
| Production | `NODE_ENV=production npm start` |
