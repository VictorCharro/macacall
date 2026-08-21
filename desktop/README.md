# MacaCall Desktop

A native Windows shell around https://macacall.vercel.app -- same idea as
Discord's own Electron client: a window pointed at the real site, with an
app icon, a dark title bar matching the web app, a system tray icon
(minimizes there instead of quitting), and native Windows notifications for
whatever the site already pushes via the Notification/Push API.

This does **not** run the Next.js server locally -- it's a thin native
wrapper around the already-deployed site, so there's nothing to keep in
sync here when the web app changes; a rebuild is only needed for changes
to this folder itself (window behavior, tray, icon).

## Run it locally (dev)

```bash
cd desktop
npm install
npm start
```

## Build the Windows installer

```bash
cd desktop
npm install
npm run dist
```

The installer (`.exe`) shows up in `desktop/dist/`. It isn't code-signed, so
Windows SmartScreen will warn on first run -- click "Mais informações" ->
"Executar assim mesmo". A real code-signing certificate (~US$200-400/year)
removes that warning if this ever needs to go out more broadly.

## Files

- `main.js` -- Electron main process: window creation, tray, single-instance
  lock, external-link handling, minimize-to-tray on close.
- `preload.js` -- intentionally empty; the web app needs no Electron-specific
  APIs, so `contextIsolation`/`nodeIntegration` stay locked down.
- `icon.ico` -- copied from `src/app/favicon.ico`. Replace both together if
  the app icon ever changes, so the desktop shell and the web favicon match.
