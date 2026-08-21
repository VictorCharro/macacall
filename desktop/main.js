const { app, BrowserWindow, Tray, Menu, shell, nativeImage, ipcMain } = require("electron");
const path = require("path");
const { autoUpdater } = require("electron-updater");

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
    // shell for our own domain, there's nothing to gate here. Missing
    // "display-capture" here was the actual reason screen share did
    // nothing when clicked: this handler was rejecting the permission
    // before setDisplayMediaRequestHandler below ever got a chance to show
    // the picker, so getDisplayMedia() just failed silently.
    mainWindow.webContents.session.setPermissionRequestHandler(
      (_webContents, permission, callback) => {
        callback(
          permission === "notifications" ||
            permission === "media" ||
            permission === "display-capture",
        );
      },
    );
    // Chromium runs a synchronous "check" ahead of some permission requests
    // -- belt-and-suspenders alongside the request handler above.
    // ("display-capture" isn't one of the permissions this particular
    // handler ever gets asked about, only the request handler above.)
    mainWindow.webContents.session.setPermissionCheckHandler(
      (_webContents, permission) => permission === "notifications" || permission === "media",
    );

    // A regular Chrome browser shows its own screen/window picker for
    // getDisplayMedia() automatically; Electron doesn't, so without this
    // handler the call just hangs/rejects and screen share never starts.
    // useSystemPicker hands it off to Windows' own native picker instead of
    // building a custom source-selection UI here.
    mainWindow.webContents.session.setDisplayMediaRequestHandler(
      (_request, callback) => callback({}),
      { useSystemPicker: true },
    );

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      else mainWindow?.show();
    });

    setupAutoUpdater();
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

  // Discord's real client reserves an actual strip at the top of the window
  // for its title bar -- nothing else renders under it. Our page has no
  // such reserved space, so the native min/max/close overlay was drawing
  // straight on top of real app content (the members list, in the report
  // that caught this). Fixed the right way, not just "make the top
  // draggable": push the whole app down by the bar's height and paint a
  // real bar in its place, all injected from the shell side only -- the
  // site's own source is untouched, so browser users see none of this.
  const TITLE_BAR_HEIGHT = 36;
  const dragRegionCss = `
    :root { --electron-titlebar-h: ${TITLE_BAR_HEIGHT}px; }

    body::before {
      content: "";
      position: fixed;
      top: 0; left: 0; right: 0;
      height: var(--electron-titlebar-h);
      background: ${TITLE_BAR_COLOR};
      z-index: 2147483647;
      -webkit-app-region: drag;
    }

    /* The app shell at /bandos uses fixed inset-0 instead of normal
       document flow, so body padding alone wouldn't move it -- shift its
       top down explicitly. Everything else (landing, login, signup) is
       normal flow and just needs body's padding. */
    .fixed.inset-0 { top: var(--electron-titlebar-h) !important; }
    body { padding-top: var(--electron-titlebar-h); }
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

// Native dialog.showMessageBox is the plain OS-styled box -- looks nothing
// like the app. This is our own small themed window instead (dialog.html +
// dialog-preload.js), resolving to the index of whichever button was
// clicked (or -1 if the window was closed without choosing).
function showCustomDialog({ title, message, icon, buttons = ["OK"], defaultIndex = 0 }) {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const dlg = new BrowserWindow({
      width: 380,
      height: 190,
      parent: mainWindow ?? undefined,
      modal: !!mainWindow,
      resizable: false,
      minimizable: false,
      maximizable: false,
      frame: false,
      backgroundColor: TITLE_BAR_COLOR,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, "dialog-preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    dlg.setMenuBarVisibility(false);
    dlg.loadFile(path.join(__dirname, "dialog.html"));

    dlg.once("ready-to-show", () => {
      dlg.webContents.send("dialog-init", { title, message, icon, buttons, defaultIndex });
      dlg.show();
    });

    function onResponse(event, index) {
      if (event.sender !== dlg.webContents) return;
      ipcMain.removeListener("dialog-response", onResponse);
      settle(index);
      dlg.close();
    }
    ipcMain.on("dialog-response", onResponse);

    dlg.on("closed", () => {
      ipcMain.removeListener("dialog-response", onResponse);
      settle(-1);
    });
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
      label: "Verificar atualizações",
      click: () => checkForUpdates({ manual: true }),
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

// Checks GitHub Releases (via the `publish` config in package.json) for a
// newer tagged version, downloads it in the background, and prompts to
// restart once it's ready -- no manual .exe download needed for updates
// after this first release. `manual` controls whether "you're already up
// to date" / errors get a dialog (tray menu click) or stay silent
// (the automatic startup check, which shouldn't nag on every launch).
let manualCheckInFlight = false;

function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-downloaded", async (info) => {
    const index = await showCustomDialog({
      icon: "🐒",
      title: "Atualização pronta",
      message: `A versão ${info.version} foi baixada. Reiniciar agora pra instalar?`,
      buttons: ["Reiniciar agora", "Depois"],
      defaultIndex: 0,
    });
    if (index === 0) {
      isQuitting = true;
      // isSilent, isForceRunAfter -- without isSilent this runs the full
      // interactive NSIS wizard again (install-for-me/all-users, directory
      // picker...), which is exactly the multi-click flow this is meant to
      // replace. oneClick:false in the build config only affects the
      // *manual* first install; this is the separate lever for updates.
      autoUpdater.quitAndInstall(true, true);
    }
  });

  autoUpdater.on("error", (err) => {
    if (manualCheckInFlight) {
      showCustomDialog({
        icon: "⚠️",
        title: "Erro ao buscar atualização",
        message: err?.message ?? String(err),
      });
    }
    manualCheckInFlight = false;
  });

  autoUpdater.on("update-not-available", () => {
    if (manualCheckInFlight) {
      showCustomDialog({
        icon: "🐵",
        title: "MacaCall",
        message: "Você já está na versão mais recente.",
      });
    }
    manualCheckInFlight = false;
  });

  // Silent check on startup -- only surfaces UI once an update actually
  // finishes downloading (the dialog above).
  checkForUpdates({ manual: false });
}

function checkForUpdates({ manual }) {
  manualCheckInFlight = manual;
  // Errors surface through the "error" event below (electron-updater fires
  // both that and a rejected promise for the same failure) -- catching here
  // too would just double the dialog.
  autoUpdater.checkForUpdates().catch(() => {});
}
