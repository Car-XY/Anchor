// Electron shell: starts the Flask backend, waits until it answers, then
// opens the window. Flask serves the built frontend from frontend/dist.
const { app, BrowserWindow, Menu, shell } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

const PORT = Number(process.env.ANCHOR_PORT || 5000);
let backend;

function pythonPath() {
  // Prefer the project's virtual environment when running from source.
  const candidates = process.platform === 'win32'
    ? [path.join(__dirname, '.venv', 'Scripts', 'python.exe'), path.join(__dirname, 'venv', 'Scripts', 'python.exe')]
    : [path.join(__dirname, '.venv', 'bin', 'python'), path.join(__dirname, 'venv', 'bin', 'python')];
  return candidates.find((p) => fs.existsSync(p)) || (process.platform === 'win32' ? 'python' : 'python3');
}

function startBackend() {
  const env = { ...process.env, ANCHOR_PORT: String(PORT) };
  if (app.isPackaged) {
    // Packaged builds ship a frozen backend (backend/dist/app.exe) and the built frontend.
    env.FRONTEND_DIST = path.join(process.resourcesPath, 'frontend');
    backend = spawn(path.join(process.resourcesPath, 'backend', 'app.exe'), [], { env });
  } else {
    backend = spawn(pythonPath(), [path.join(__dirname, 'backend', 'wsgi.py')], { env, cwd: path.join(__dirname, 'backend') });
  }
  backend.stdout.on('data', (d) => console.log(`backend: ${d}`));
  backend.stderr.on('data', (d) => console.error(`backend: ${d}`));
  backend.on('exit', (code) => console.log(`backend exited (${code})`));
}

function waitForBackend(timeoutMs = 20000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const ping = () => {
      const req = http.get({ host: '127.0.0.1', port: PORT, path: '/api/health', timeout: 1000 }, (res) => {
        res.resume();
        if (res.statusCode === 200) resolve();
        else retry();
      });
      req.on('error', retry);
      req.on('timeout', () => req.destroy());
    };
    const retry = () => (Date.now() - started > timeoutMs ? reject(new Error('Backend did not start')) : setTimeout(ping, 250));
    ping();
  });
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 380,
    backgroundColor: '#0b1a26',
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  win.once('ready-to-show', () => win.show());
  // Open external links (GitHub, LinkedIn…) in the browser, not inside Anchor.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  try {
    await waitForBackend();
    await win.loadURL(`http://127.0.0.1:${PORT}`);
  } catch (err) {
    await win.loadURL(`data:text/html,<h1 style="font-family:sans-serif">Anchor couldn't start its backend.</h1><p style="font-family:sans-serif">${encodeURIComponent(err.message)}. Check that the Python environment is installed (see README).</p>`);
    win.show();
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  startBackend();
  createWindow();
});

app.on('window-all-closed', () => {
  if (backend) backend.kill();
  if (process.platform !== 'darwin') app.quit();
});
