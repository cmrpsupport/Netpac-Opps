# Server deployment

## Quick run (Node.js already installed)

From the project root:

```bash
bash scripts/install-and-run.sh
```

This will:

- Check for Node.js (exit with instructions if missing)
- Run `npm install`
- Create `.env` from `.env.example` if missing
- Initialize local SQLite DB (`node scripts/init-local-sqlite.js`)
- Start the server (`node server.js`)

Default port is 3000 (or set `PORT` in `.env`).

---

## First-time server setup (install Node.js then run)

On Ubuntu/Debian, to install Node.js LTS if needed and then install + run the app:

```bash
bash scripts/server-setup.sh
```

Requires `curl` and `sudo` for installing Node.js.

---

## Manual steps

1. **Node.js** – LTS (v18 or v20). Install from [nodejs.org](https://nodejs.org/) or your distro.
2. **Clone/copy** the project to the server.
3. **Install and run:**
   ```bash
   cd /path/to/netpacOpps
   npm install
   cp .env.example .env   # then edit .env: JWT_SECRET, PORT
   node scripts/init-local-sqlite.js
   node server.js
   ```
4. **Production** – Use a process manager (e.g. systemd or PM2) and a reverse proxy (e.g. nginx). Set `NODE_ENV=production` and a strong `JWT_SECRET` in `.env`.

---

## Run in background (PM2 example)

```bash
npm install -g pm2
pm2 start server.js --name netpac-opps
pm2 save
pm2 startup   # enable start on boot
```
