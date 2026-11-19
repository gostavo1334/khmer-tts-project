const { app, BrowserWindow, Menu, shell, session, systemPreferences } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow = null;
let pythonProcess = null;
const isDev = process.env.NODE_ENV !== 'production';
const PORT_NEXT = process.env.PORT || 3000;
const PORT_TTS = 8000;

// Helper to check if a port is in use / responding
function checkServer(port, path = '/health') {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}${path}`, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// Start the Python TTS server if not already running
async function startPythonServer() {
  const isRunning = await checkServer(PORT_TTS, '/health');
  if (isRunning) {
    console.log(`[Desktop] TTS server already running on port ${PORT_TTS}`);
    return;
  }

  const projectRoot = path.join(__dirname, '..');
  const venvPythonMac = path.join(projectRoot, '.venv', 'bin', 'python');
  const venvPythonWin = path.join(projectRoot, '.venv', 'Scripts', 'python.exe');
  
  let pythonExecutable = 'python3';
  const fs = require('fs');
  if (fs.existsSync(venvPythonMac)) {
    pythonExecutable = venvPythonMac;
  } else if (fs.existsSync(venvPythonWin)) {
    pythonExecutable = venvPythonWin;
  }

  console.log(`[Desktop] Spawning TTS server with ${pythonExecutable}...`);
  pythonProcess = spawn(
    pythonExecutable,
    ['-m', 'uvicorn', 'server:app', '--app-dir', 'tts_server', '--host', '127.0.0.1', '--port', String(PORT_TTS)],
    {
      cwd: projectRoot,
      env: { ...process.env, PYTHONPATH: projectRoot },
      stdio: 'pipe',
    }
  );

  pythonProcess.stdout.on('data', (data) => {
    console.log(`[TTS stdout]: ${data}`);
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`[TTS stderr]: ${data}`);
  });

  pythonProcess.on('exit', (code, signal) => {
    console.log(`[Desktop] TTS server exited with code ${code}, signal ${signal}`);
  });
}

// Stop Python server on app quit
function stopPythonServer() {
  if (pythonProcess && !pythonProcess.killed) {
    console.log('[Desktop] Stopping Python TTS server...');
    try {
      pythonProcess.kill('SIGINT');
      setTimeout(() => {
        if (pythonProcess && !pythonProcess.killed) {
          pythonProcess.kill('SIGKILL');
        }
      }, 2000);
    } catch (e) {
      console.error('[Desktop] Error stopping python process:', e);
    }
    pythonProcess = null;
  }
}

// Wait for Next.js server to be ready
async function waitForNextServer(timeoutMs = 30000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const isUp = await checkServer(PORT_NEXT, '/');
    if (isUp) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 840,
    minWidth: 860,
    minHeight: 600,
    title: 'Khmer Pro · AI Voice Studio & Alphabet',
    backgroundColor: '#0f0d0e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  // Open external links in user's default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  const appUrl = `http://localhost:${PORT_NEXT}`;
  console.log(`[Desktop] Loading app from ${appUrl}`);
  mainWindow.loadURL(appUrl);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Set up native application menu
function createMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac
      ? [
          {
            label: 'Khmer Alphabet',
            submenu: [
              { role: 'about', label: 'About Khmer Alphabet' },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ]
      : []),
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [{ type: 'separator' }, { role: 'front' }, { type: 'window' }]
          : [{ role: 'close' }]),
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// App lifecycle
app.whenReady().then(async () => {
  createMenu();

  // Handle media/microphone permissions
  if (process.platform === 'darwin' && systemPreferences.askForMediaAccess) {
    systemPreferences.askForMediaAccess('microphone').then((granted) => {
      console.log('[Desktop] macOS microphone permission granted:', granted);
    }).catch((err) => {
      console.warn('[Desktop] Error checking microphone permission:', err);
    });
  }

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      return callback(true);
    }
    callback(true);
  });

  if (session.defaultSession.setPermissionCheckHandler) {
    session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
      if (permission === 'media') {
        return true;
      }
      return true;
    });
  }

  await startPythonServer();
  
  // Wait for Next.js
  const ready = await waitForNextServer(20000);
  if (!ready) {
    console.warn('[Desktop] Next.js server was not detected immediately, attempting to load URL anyway...');
  }
  
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopPythonServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopPythonServer();
});
