# Run with system tray (Windows)

So the app keeps running when you close the window and sits in the system tray:

1. **Install Electron once** (needed for tray):
   ```cmd
   npm install electron
   ```

2. **Set IP and port** in `.env` (create from `.env.example` if needed):
   ```env
   HOST=0.0.0.0
   PORT=3000
   ```
   - `HOST=0.0.0.0` = listen on all IPs (other PCs on LAN can connect).
   - `HOST=127.0.0.1` = only this computer.
   - `PORT` = port number (e.g. 3000).

3. **Run with tray**:
   ```cmd
   npm run tray
   ```
   A tray icon appears. You can close the terminal window; the server keeps running.

4. **Tray menu**:
   - **Open app** – open the app in the browser.
   - **Exit** – stop the server and quit.

---

## Without tray (normal CMD)

**Set IP and port** in `.env`:
```env
HOST=0.0.0.0
PORT=3000
```

**Run:**
```cmd
node server.js
```
Or:
```cmd
npm start
```

Access at `http://localhost:3000` or `http://YOUR_IP:3000`.
