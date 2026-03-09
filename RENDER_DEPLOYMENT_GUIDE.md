# Deploy on Render (production)

**Production runs on Render.** The app uses **SQLite Cloud** as the database (no local database on Render).

---

## Option A: Blueprint (recommended)

1. **Go to Render**: [https://render.com](https://render.com) - sign in.
2. **New -> Blueprint**: Connect your GitHub repo and select the branch (e.g. `main`).
3. Render will read `render.yaml` and create the web service with:
   - **Build**: `npm install`
   - **Start**: `node server.js`
   - **Env**: `NODE_ENV=production`
4. **Set secrets in the dashboard** (Environment):
   - `SQLITECLOUD_URL` - required; your SQLite Cloud connection URL (e.g. `sqlitecloud://xxx.g4.sqlite.cloud:8860/auth.sqlitecloud?apikey=...`). Get this from your SQLite Cloud dashboard.
   - `JWT_SECRET` - required; use a strong random string.
   - `FRONTEND_URL` - your frontend URL for CORS (e.g. `https://your-app.onrender.com`).

`PORT` is set automatically by Render; do not set it.

---

## Option B: Manual Web Service

1. **Go to Render** - **New +** - **Web Service**.
2. Connect your GitHub repo and branch (e.g. `main`).
3. **Configure**:
   - **Name**: e.g. `netpac-opps` or `cmrp-opps-backend`
   - **Root Directory**: leave empty
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: Free or paid

4. **Environment variables** (in Render dashboard - Environment):

   | Key               | Value |
   |-------------------|--------|
   | `NODE_ENV`        | `production` |
   | `SQLITECLOUD_URL` | your SQLite Cloud URL (from SQLite Cloud dashboard) |
   | `JWT_SECRET`      | your-secure-random-string |
   | `FRONTEND_URL`    | `https://your-frontend-url.onrender.com` |

   Do **not** set `PORT` - Render sets it.

---

## Database (SQLite Cloud)

- The app uses **SQLite Cloud** only in production. Set `SQLITECLOUD_URL` to your connection URL (includes host, database name, and apikey).
- **One-time setup**: Run the schema and migrations once against your SQLite Cloud database:
  ```bash
  SQLITECLOUD_URL='your-url-here' node scripts/init-sqlite-cloud.js
  ```
  Or set `SQLITECLOUD_URL` in `.env` and run: `npm run db:init-cloud`
- Do not commit your `SQLITECLOUD_URL` or API key to git; set it only in Render Environment or in a local `.env` file.

---

## Frontend (if separate)

1. **New +** - **Static Site**.
2. Connect the same repo and branch.
3. **Publish Directory**: set to the folder that contains your built frontend (e.g. `.` or `dist`).
4. After deploy, set the backend's `FRONTEND_URL` to this site's URL (for CORS).

---

## After deployment

- Backend URL will be like: `https://<service-name>.onrender.com`.
- Point your frontend's API/config to this URL (e.g. `API_BASE_URL` or `config.js`).
- Ensure `FRONTEND_URL` in the backend matches the frontend origin to avoid CORS errors.

---

## Troubleshooting

| Issue | Check |
|-------|--------|
| CORS errors | `FRONTEND_URL` in backend matches frontend origin (scheme + host, no trailing slash). |
| API not found | Frontend `API_BASE_URL` / config points to the Render backend URL. |
| Auth / JWT | `JWT_SECRET` is set in Render Environment. |
| DB errors | `SQLITECLOUD_URL` is set correctly in Render Environment. Run `npm run db:init-cloud` once to apply schema if the database is new. |
| Module not found | Start command is `node server.js` (not `npm start`). |

---

## What to add in Render Environment

In **Render Dashboard → your service → Environment**, add:

| Variable | Required | Example / notes |
|----------|----------|------------------|
| **NODE_ENV** | Yes | `production` (Blueprint may set this) |
| **SQLITECLOUD_URL** | Yes | `sqlitecloud://xxx.g4.sqlite.cloud:8860/auth.sqlitecloud?apikey=...` from SQLite Cloud dashboard |
| **JWT_SECRET** | Yes | Long random string (e.g. `openssl rand -hex 32`) |
| **FRONTEND_URL** | Yes (if CORS needed) | `https://netpac-opps.onrender.com` (your app URL, no trailing slash) |
| **PORT** | No | Do **not** set; Render sets it automatically |
| **NETPACIFIC_TENANT_CODE** | No | `default` (or your tenant code) |
| **PROJECT_CODE_PREFIX** | No | `CMRP` (project code prefix) |
| **ENABLE_AUTO_SNAPSHOTS** | No | `true` to enable snapshot automation |

Minimum for a working deploy: **NODE_ENV**, **SQLITECLOUD_URL**, **JWT_SECRET**, and **FRONTEND_URL** (if the frontend is on a different origin or you use CORS).

---

## Quick reference

| Item | Value |
|------|--------|
| **Production** | Render (this guide) |
| **Database** | SQLite Cloud (`SQLITECLOUD_URL`) |
| **Local / on-prem** | [RUN_ON_SERVER_POWERSHELL.md](./RUN_ON_SERVER_POWERSHELL.md) (optional) |
| **Start** | `node server.js` |
| **Build** | `npm install` |
| **Init DB (one-time)** | `npm run db:init-cloud` (with `SQLITECLOUD_URL` set) |
