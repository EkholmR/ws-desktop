// Change these two URLs when the servers are deployed
const CONFIG = {
  LOGIN_URL: 'https://wom-p2-del3.onrender.com/api/auth/login', // use your deployed login URL
  WS_URL: 'wss://websocket-server-npvo.onrender.com'
};

const TOKEN_KEY = 'jwt';
const USERNAME_KEY = 'lastUsername'; // NEW

const loginSection = document.getElementById('login-section');
const appSection = document.getElementById('app-section');
const loginForm = document.getElementById('login-form');
const loginMessage = document.getElementById('login-message');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const logoutBtn = document.getElementById('logout-btn');
const statusEl = document.getElementById('status');
const reconnectBtn = document.getElementById('reconnect-btn');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const messagesEl = document.getElementById('messages');

let socket = null;
let expiryTimer = null; // NEW

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

// NEW: read the payload of a JWT (no verification, the server does that)
function parseToken(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch (err) {
    return null;
  }
}

// NEW: true if the token is missing a valid exp or has passed it
function isExpired(token) {
  const payload = parseToken(token);
  if (!payload || typeof payload.exp !== 'number') return true;
  return payload.exp * 1000 <= Date.now();
}

// NEW: log the user out the moment the token runs out
function scheduleExpiry(token) {
  clearTimeout(expiryTimer);
  const payload = parseToken(token);
  if (!payload || typeof payload.exp !== 'number') return;
  const msLeft = payload.exp * 1000 - Date.now();
  expiryTimer = setTimeout(expireSession, Math.min(Math.max(msLeft, 0), 2147483647));
}

// NEW
function expireSession() {
  localStorage.removeItem(TOKEN_KEY);
  showLoggedOut('Din inloggning har gått ut. Logga in igen.');
}

function setStatus(state, text) {
  statusEl.textContent = text;
  statusEl.className = `status ${state}`;
}


// Show a received message, newest first, with the arrival time and a copy button
function addMessage(text) {
  const li = document.createElement('li');

  const span = document.createElement('span');
  span.className = 'msg-text';
  span.textContent = text; // textContent, so received text is never run as HTML

  const time = document.createElement('time');
  time.className = 'msg-time';
  time.textContent = new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'copy-btn';
  copyBtn.textContent = 'Kopiera';
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = 'Kopierad!';
    } catch (err) {
      copyBtn.textContent = 'Kunde inte kopiera';
    }
    setTimeout(() => { copyBtn.textContent = 'Kopiera'; }, 1500);
  });

  li.append(span, copyBtn, time);
  messagesEl.prepend(li);
}


function sendMessage() {
  const text = messageInput.value;
  if (text.trim() === '') return;

  if (!socket || socket.readyState !== WebSocket.OPEN) {
    setStatus('disconnected', 'Frånkopplad – kan inte skicka');
    return;
  }

  socket.send(text);
  messageInput.value = '';
}

function closeSocket() {
  if (socket) {
    const old = socket;
    socket = null; // handlers below ignore sockets that are no longer current
    old.close();
  }
}

function connect() {
  const token = getToken();
  if (!token) {
    showLoggedOut();
    return;
  }
  // NEW: never try to connect with an expired token
  if (isExpired(token)) {
    expireSession();
    return;
  }

  closeSocket();
  setStatus('connecting', 'Ansluter...');

  const ws = new WebSocket(`${CONFIG.WS_URL}?token=${encodeURIComponent(token)}`);
  socket = ws;

  ws.onopen = () => {
    if (ws === socket) setStatus('connected', 'Ansluten');
  };
  ws.onmessage = (event) => {
    if (ws === socket) addMessage(event.data);
  };
  ws.onclose = () => {
    if (ws !== socket) return;
    setStatus('disconnected', 'Frånkopplad');
    // NEW: a closed connection with an expired token means "log in again"
    const current = getToken();
    if (current && isExpired(current)) expireSession();
  };
  // Browsers give no details about a failed connection; onclose follows anyway
  ws.onerror = () => {};
}

function showLoggedIn() {
  loginSection.hidden = true;
  appSection.hidden = false;
  scheduleExpiry(getToken()); // NEW
  connect();
}

function showLoggedOut(message = '') {
  clearTimeout(expiryTimer); // NEW
  closeSocket();
  loginSection.hidden = false;
  appSection.hidden = true;
  loginMessage.textContent = message;
  // NEW: prefill the last username so only the password is needed
  usernameInput.value = localStorage.getItem(USERNAME_KEY) || '';
  (usernameInput.value ? passwordInput : usernameInput).focus();
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginMessage.textContent = '';

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  try {
    const response = await fetch(CONFIG.LOGIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      loginMessage.textContent = data.error || `Inloggningen misslyckades (${response.status})`;
      return;
    }

    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USERNAME_KEY, username); // NEW (the password is never stored)
    loginForm.reset();
    showLoggedIn();
  } catch (err) {
    loginMessage.textContent = 'Kunde inte nå inloggningstjänsten. Kontrollera adressen och att servern kör.';
  }
});

sendBtn.addEventListener('click', sendMessage);

// Ctrl+Enter sends from inside the text box
messageInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && event.ctrlKey) {
    event.preventDefault();
    sendMessage();
  }
});

reconnectBtn.addEventListener('click', connect);

logoutBtn.addEventListener('click', () => {
  localStorage.removeItem(TOKEN_KEY);
  messagesEl.innerHTML = '';
  showLoggedOut();
});

// On page load: stay logged in only if there is a token that hasn't expired
const storedToken = getToken();
if (storedToken && !isExpired(storedToken)) {
  showLoggedIn();
} else if (storedToken) {
  expireSession(); // NEW: stale token from an earlier visit
} else {
  showLoggedOut();
}