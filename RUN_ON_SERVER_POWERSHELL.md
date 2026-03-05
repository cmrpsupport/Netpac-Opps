# Deployment: Render (production)

**Production runs on Render.** The app uses **SQLite Cloud** as the database (no local DB on the server).

---

## Deploy on Render

1. **Follow the Render guide**: [RENDER_DEPLOYMENT_GUIDE.md](./RENDER_DEPLOYMENT_GUIDE.md)
2. **Or use the Blueprint**: If your repo has a `render.yaml`, connect the repo in Render and use "New -> Blueprint" to create the web service from the spec.

Set these in the Render dashboard (Environment):

- `NODE_ENV=production`
- `SQLITECLOUD_URL` - your SQLite Cloud connection URL (e.g. `sqlitecloud://xxx.g4.sqlite.cloud:8860/auth.sqlitecloud?apikey=...`)
- `JWT_SECRET` - strong random secret
- `FRONTEND_URL` - your frontend URL for CORS (e.g. `https://your-app.onrender.com`)

`PORT` is set automatically by Render.

---

## Local / on-prem only (optional)

If you run the app on a **Windows server**, set `SQLITECLOUD_URL` in `.env` (same as production) so it uses SQLite Cloud. Optionally for dev you can use local SQLite: set `USE_SQLITE_LOCAL=1`, run `node scripts/init-local-sqlite.js`, then start the server.

### Quick steps (with SQLite Cloud)

```powershell
cd C:\path\to\netpacOpps
Copy-Item .env.example .env
# Edit .env: set SQLITECLOUD_URL, JWT_SECRET, HOST=0.0.0.0, PORT=3000
npm install
node server.js
```

### Optional: local SQLite (dev only)

```powershell
# In .env set USE_SQLITE_LOCAL=1 and optionally SQLITE_DB_PATH
node scripts/init-local-sqlite.js
node server.js
```

To run in background with PM2:

```powershell
npm install -g pm2
pm2 start server.js --name netpac-opps
pm2 save
pm2 startup
```

---

## Quick reference

| Environment | Where to look |
|-------------|----------------|
| **Production (Render)** | [RENDER_DEPLOYMENT_GUIDE.md](./RENDER_DEPLOYMENT_GUIDE.md) |
| **Local / on-prem (Windows)** | Section above (optional) |
