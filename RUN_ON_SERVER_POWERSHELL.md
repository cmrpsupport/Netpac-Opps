# How to run the app on your server (PowerShell)

Step-by-step guide to run the Netpac Opps app on a Windows server using PowerShell.

---

## 1. Prerequisites

- **Node.js** (LTS, e.g. v18 or v20)  
  - Download: https://nodejs.org/  
  - Install, then restart PowerShell.  
  - Check:
    ```powershell
    node -v
    npm -v
    ```

- **Project folder** on the server (e.g. `C:\netpacOpps` or wherever you copied/cloned it).

---

## 2. Open PowerShell and go to the project

```powershell
cd C:\path\to\netpacOpps
```

Replace `C:\path\to\netpacOpps` with the actual folder path.

---

## 3. Set IP and port (optional)

Edit the `.env` file in the project folder. It should contain at least:

```env
USE_SQLITE_LOCAL=1
HOST=0.0.0.0
PORT=3000
```

- **HOST**
  - `0.0.0.0` = listen on all interfaces (recommended on the server; works from any machine).
  - Your server’s IP (e.g. `192.168.100.213`) = listen only on that IP. Use this only on the machine that actually has that IP; otherwise you get “address not available”.
- **PORT** = port number (e.g. `3000`).

If `.env` does not exist, copy from the example and edit:

```powershell
Copy-Item .env.example .env
notepad .env
```

---

## 4. Install dependencies

```powershell
npm install
```

Wait until it finishes without errors.

---

## 5. Initialize the database (first time only)

```powershell
node scripts/init-local-sqlite.js
```

Run this once (or after pulling changes that add new DB setup). It creates/updates the local SQLite database.

---

## 6. Start the server

```powershell
node server.js
```

You should see something like:

```text
🚀 Bind: 192.168.100.213:3000
🚀 Server listening at http://192.168.100.213:3000
```

- **On the server:** open a browser and go to: `http://192.168.100.213:3000` (or `http://localhost:3000`).
- **From another PC:** use `http://192.168.100.213:3000` (replace with your server’s IP if different).

To stop the server: press **Ctrl+C** in the PowerShell window.

---

## 7. Run in background (so closing PowerShell doesn’t stop it)

### Option A: Start in a new window (simple)

```powershell
Start-Process -NoNewWindow node -ArgumentList "server.js"
```

Or open a **new** PowerShell window, `cd` to the project, then run `node server.js` and leave that window open.

### Option B: Use PM2 (recommended for a real server)

1. Install PM2 globally:
   ```powershell
   npm install -g pm2
   ```

2. From the project folder, start the app:
   ```powershell
   pm2 start server.js --name netpac-opps
   ```

3. Useful commands:
   ```powershell
   pm2 status
   pm2 logs netpac-opps
   pm2 stop netpac-opps
   pm2 restart netpac-opps
   ```

4. (Optional) Start on server reboot:
   ```powershell
   pm2 startup
   pm2 save
   ```

---

## Quick reference

| Step              | Command |
|-------------------|--------|
| Go to project     | `cd C:\path\to\netpacOpps` |
| Install packages  | `npm install` |
| Init DB (1st time)| `node scripts/init-local-sqlite.js` |
| Run server        | `node server.js` |
| Run in background| `pm2 start server.js --name netpac-opps` |

---

## Troubleshooting

- **“node is not recognized”**  
  Install Node.js and restart PowerShell (or reboot).

- **Port in use**  
  Change `PORT` in `.env` (e.g. to `3001`) or stop the program using the port.

- **Can’t open from another PC**  
  - Use the server’s real IP in `HOST` (e.g. `192.168.100.213`) or `0.0.0.0`.  
  - Check Windows Firewall: allow inbound TCP on your chosen port (e.g. 3000).

- **Database errors**  
  Run again: `node scripts/init-local-sqlite.js`, then `node server.js`.
