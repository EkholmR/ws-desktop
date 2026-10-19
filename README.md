# WebSocket desktop client (Part 4)

Electron app that ports the browser client to the desktop. Connects to the WebSocket server and relays text between all clients logged in as the same user.

## Run

1. `npm install`
2. Set `LOGIN_URL` at the top of `main.js` to the login service
3. Set `WS_URL` at the top of `renderer/app.js` to the WebSocket server (`wss://...`)
4. `npm start`

## How it works

- **Login** is requested in the main process (`main.js`), not the page, so the browser's CORS rules don't apply. The page reaches it through `contextBridge` in `preload.js`.
- **The JWT** is encrypted with `safeStorage` and saved in the app's data folder. It's never put in `localStorage`.
- **Expiry:** when the token runs out, the app shows the login form again, with the username filled in.
- **WebSocket:** the token is sent as `?token=...` when the connection opens. Status and a reconnect button are shown in the window.