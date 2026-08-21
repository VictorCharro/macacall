// Runs in the renderer with Node access before the page's own scripts.
// MacaCall's web app doesn't need any Electron-specific APIs today (it
// already talks to Supabase/LiveKit over plain HTTPS/WSS), so this stays
// empty on purpose -- contextIsolation is on and nodeIntegration is off in
// main.js, so the site itself has zero Node/Electron surface to worry about.
