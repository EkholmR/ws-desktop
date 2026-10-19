const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Your deployed login service
const LOGIN_URL = 'https://wom-p2-del3.onrender.com/api/auth/login';

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,   // the page can't reach Electron/Node directly
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

// The login request is made here in the main process, not in the page,
// so the browser's CORS rules don't apply.
ipcMain.handle('auth:login', async (event, credentials) => {
  const { username, password } = credentials || {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    return { ok: false, error: 'Användarnamn och lösenord krävs' };
  }

  try {
    const response = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return { ok: false, error: data.error || `Inloggningen misslyckades (${response.status})` };
    }
    return { ok: true, token: data.token };
  } catch (err) {
    return { ok: false, error: 'Kunde inte nå inloggningstjänsten. Kontrollera adressen och att servern kör.' };
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});