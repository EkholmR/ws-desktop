const { app, BrowserWindow, ipcMain, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');

// Your deployed login service
const LOGIN_URL = 'https://wom-p2-del3.onrender.com/api/auth/login';

// The encrypted token lives in the app's own data folder
const tokenFile = () => path.join(app.getPath('userData'), 'token.bin');

function saveToken(token) {
  if (!safeStorage.isEncryptionAvailable()) return false; // never store it unencrypted
  fs.writeFileSync(tokenFile(), safeStorage.encryptString(token));
  return true;
}

function loadToken() {
  try {
    if (!safeStorage.isEncryptionAvailable()) return null;
    return safeStorage.decryptString(fs.readFileSync(tokenFile()));
  } catch (err) {
    return null; // no file yet, or it can't be decrypted
  }
}

function clearToken() {
  try {
    fs.unlinkSync(tokenFile());
  } catch (err) {
    // nothing stored
  }
}

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

    saveToken(data.token); // encrypted on disk; if encryption isn't available, memory only
    return { ok: true, token: data.token };
  } catch (err) {
    return { ok: false, error: 'Kunde inte nå inloggningstjänsten. Kontrollera adressen och att servern kör.' };
  }
});

ipcMain.handle('auth:getToken', () => loadToken());
ipcMain.handle('auth:logout', () => { clearToken(); });

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});