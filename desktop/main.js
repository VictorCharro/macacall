const { app, BrowserWindow, Tray, Menu, shell, nativeImage } = require("electron");
const path = require("path");

const APP_URL = "https://macacall.vercel.app";
const ICON_PATH = path.join(__dirname, "icon.ico");

// Discord's own dark title bar colors -- matches the web app's palette.
const TITLE_BAR_COLOR = "#1e1f22";
const TITLE_BAR_SYMBOL_COLOR = "#f2f3f5";

let mainWindow = null;
let tray = null;
let isQuitting = false;

// Only one MacaCall window at a time -- a second launch just focuses the
// existing one instead of opening a duplicate.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    createWindow();
    createTray();

    // Let the site's own Notification.requestPermission() / push subscribe
    // flow through without an extra native prompt -- this *is* the trusted
    // shell for our own domain, there's nothing to gate here.
    mainWindow.webContents.session.setPermissionRequestHandler(
      (_webContents, permission, callback) => {
        callback(permission === "notifications" || permission === "media");
      },
    );

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      else mainWindow?.show();
    });
  });

  app.on("before-quit", () => {
    isQuitting = true;
  });

  app.on("window-all-closed", () => {
    // Minimizing to tray means "all windows closed" only really happens on
    // an explicit quit -- don't fall back to quitting on other platforms'
    // usual convention here, the tray is the whole point.
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#313338",
    icon: ICON_PATH,
    autoHideMenuBar: true,
    // Custom-colored title bar (Windows 11) with native minimize/maximize/
    // close buttons, matching Discord's own dark chrome. Electron ignores
    // titleBarOverlay gracefully where it isn't supported (Windows 10),
    // falling back to the default frame.
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: TITLE_BAR_COLOR,
      symbolColor: TITLE_BAR_SYMBOL_COLOR,
      height: 36,
    },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  });

  mainWindow.loadURL(APP_URL);

  // The web app has no dedicated title-bar strip of its own (unlike
  // Discord's real client, which reserves that space) -- with no
  // -webkit-app-region declared anywhere, the whole custom-colored title
  // bar area was undraggable. Injected purely from the shell side (not
  // touching the site's own source, so regular browser users are
  // unaffected): each screen's top <header> bar becomes a drag handle,
  // while every interactive element keeps working normally as a click
  // target instead of starting a drag.
  const dragRegionCss = `
    header { -webkit-app-region: drag; }
    header button,
    header a,
    header input,
    header select,
    header textarea,
    header [role="button"] {
      -webkit-app-region: no-drag;
    }
  `;
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.insertCSS(dragRegionCss);
  });

  // Keep the app scoped to our own domain -- anything that would open a new
  // window (an external link, an OAuth popup, whatever) opens in the user's
  // real browser instead of spawning another Electron window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(APP_URL)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Closing the window minimizes to the tray instead of quitting -- same as
  // Discord. Only the tray's own "Sair" (or Cmd+Q) actually exits.
  mainWindow.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow.hide();
  });
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(ICON_PATH));
  tray.setToolTip("MacaCall");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Abrir MacaCall",
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    {
      label: "Iniciar com o Windows",
      type: "checkbox",
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => {
        app.setLoginItemSettings({ openAtLogin: item.checked });
      },
    },
    { type: "separator" },
    {
      label: "Sair",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on("click", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}
