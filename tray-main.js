/**
 * Tray launcher: runs the server and shows a system-tray icon so closing the window doesn't stop the app.
 * Requires: npm install electron
 * Run: npm run tray   (or: npx electron tray-main.js)
 */
const { app, Tray, Menu, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let tray = null;
let serverProcess = null;

function getIcon(nativeImage) {
  const fs = require('fs');
  const base = path.join(__dirname, 'assets');
  for (const name of ['tray.ico', 'favicon.ico', 'netpacific-logo.jpg', 'netpacific-logo.png']) {
    const icon = path.join(base, name);
    if (fs.existsSync(icon)) return icon;
  }
  return null;
}

function startServer() {
  const port = process.env.PORT || 3000;
  const host = process.env.HOST || '0.0.0.0';
  const serverPath = path.join(__dirname, 'server.js');
  serverProcess = spawn(process.execPath, [serverPath], {
    env: { ...process.env, HOST: host, PORT: String(port) },
    stdio: 'inherit',
    cwd: __dirname
  });
  serverProcess.on('error', (err) => console.error('Server failed:', err));
  serverProcess.on('exit', (code) => {
    if (code !== null && code !== 0) console.error('Server exited with code', code);
  });
}

function openApp() {
  const port = process.env.PORT || 3000;
  const host = process.env.HOST === '0.0.0.0' ? 'localhost' : (process.env.HOST || 'localhost');
  shell.openExternal(`http://${host}:${port}`);
}

function quit() {
  if (serverProcess) serverProcess.kill();
  app.quit();
}

app.whenReady().then(() => {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
  startServer();
  const { nativeImage } = require('electron');
  const iconPath = getIcon();
  const icon = iconPath ? nativeImage.createFromPath(iconPath) : nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('Netpac Opps – server running');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open app', click: openApp },
    { type: 'separator' },
    { label: 'Exit', click: quit }
  ]));
  tray.on('double-click', openApp);
});

app.on('window-all-closed', () => {});
app.on('before-quit', () => { if (serverProcess) serverProcess.kill(); });
