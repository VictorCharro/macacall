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

## Releasing an update

The app checks GitHub Releases for updates (see "Auto-update" below), which
only works if **every** release includes both files `npm run dist` produces
in `desktop/dist/`:

- `MacaCall-Setup-<version>.exe` -- the installer itself
- `latest.yml` -- tells electron-updater a newer version exists and where
  to get it; without this file the app just never sees the release

1. Bump `"version"` in `desktop/package.json`.
2. `npm run dist`.
3. Create a GitHub release (tag can be anything, e.g. `desktop-v1.1.0`) and
   attach both files from `desktop/dist/` -- the `.blockmap` too if present,
   it lets electron-updater download only the changed bytes instead of the
   whole installer again.

## Auto-update

Wired through `electron-updater` (see `setupAutoUpdater()` in `main.js`):
checks silently on startup, downloads a newer version in the background,
and asks to restart once it's ready. The tray's "Verificar atualizações"
does the same check on demand, but (unlike the silent startup check) tells
you if you're already current or if the check failed.

## Screen sharing

`getDisplayMedia()` needs help from the shell in Electron -- a regular
browser shows its own screen/window picker automatically, Electron doesn't.
Handled in `main.js` via `session.setDisplayMediaRequestHandler` +
`desktopCapturer.getSources()`, with our own small picker window
(`picker.html` + `picker-preload.js`) instead of Electron's built-in
`useSystemPicker` option -- that one only hands off to the OS's native
picker on fairly recent Windows/macOS, and silently shows nothing at all
otherwise, which looks identical to "the button just does nothing" from
the user's side. Also needs `session.setPermissionCheckHandler` to allow
`"display-capture"` **in addition to** `setPermissionRequestHandler` --
missing it from either one blocks the whole thing silently, no error.

## Files

- `main.js` -- Electron main process: window creation, tray, single-instance
  lock, external-link handling, minimize-to-tray on close, screen-share
  source picking.
- `preload.js` -- intentionally empty; the web app needs no Electron-specific
  APIs, so `contextIsolation`/`nodeIntegration` stay locked down.
- `picker.html` / `picker-preload.js` -- the screen/window picker shown when
  someone clicks "compartilhar tela" (see "Screen sharing" above).
- `dialog.html` / `dialog-preload.js` -- the themed dialog used for the
  "update ready, restart now?" prompt.
- `icon.ico` -- copied from `src/app/favicon.ico`. Replace both together if
  the app icon ever changes, so the desktop shell and the web favicon match.
