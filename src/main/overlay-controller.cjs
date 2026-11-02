function createOverlayController({ BrowserWindow, attachToBrowser, onAttachFailure, preloadPath, lockPagePath }) {
  const windows = new Map();
  const attachedOverlays = new Set();
  const lastOverlayState = new Map();

  function createOverlay(browserWindow) {
    const overlay = new BrowserWindow({
      ...browserWindow.bounds,
      frame: false,
      resizable: false,
      movable: false,
      focusable: true,
      alwaysOnTop: false,
      skipTaskbar: true,
      show: false,
      backgroundColor: '#10131b',
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    if (!attachToBrowser) attachedOverlays.add(String(browserWindow.id));
    overlay.webContents.once('did-finish-load', () => {
      if (!attachToBrowser) return;
      return Promise.resolve(attachToBrowser(browserWindow.id, overlay)).then(() => {
        attachedOverlays.add(String(browserWindow.id));
      }).catch(error => {
        overlay.hide();
        onAttachFailure?.(browserWindow, error);
      });
    });
    overlay.loadFile(lockPagePath);
    return overlay;
  }

  function hideAll() {
    for (const overlay of windows.values()) {
      if (!overlay.isDestroyed()) overlay.hide();
    }
  }

  function sync({ lockActive, browserWindows = [], remainingMs = 0, suppressed = false }) {
    if (suppressed || !lockActive) {
      hideAll();
      return;
    }

    const activeIds = new Set(browserWindows.map(window => String(window.id)));
    for (const browserWindow of browserWindows) {
      const id = String(browserWindow.id);
      let overlay = windows.get(id);
      if (!overlay || overlay.isDestroyed()) {
        overlay = createOverlay(browserWindow);
        windows.set(id, overlay);
        overlay.on('closed', () => {
          attachedOverlays.delete(id);
          lastOverlayState.delete(id);
          if (windows.get(id) === overlay) windows.delete(id);
        });
      }

      if (browserWindow.minimized || !browserWindow.visible) {
        overlay.hide();
        continue;
      }
      if (!attachedOverlays.has(id)) {
        overlay.hide();
        continue;
      }

      const previous = lastOverlayState.get(id) ?? {};
      const boundsKey = `${browserWindow.bounds.x},${browserWindow.bounds.y},${browserWindow.bounds.width},${browserWindow.bounds.height}`;
      if (previous.boundsKey !== boundsKey) overlay.setBounds(browserWindow.bounds);
      const remainingSecond = Math.ceil(remainingMs / 1000);
      if (previous.remainingSecond !== remainingSecond) overlay.webContents.send('lock:remaining', remainingMs);
      if (typeof overlay.isVisible !== 'function' || !overlay.isVisible()) overlay.showInactive();
      if (browserWindow.foreground && !overlay.isFocused()) overlay.focus();
      lastOverlayState.set(id, { boundsKey, remainingSecond });
    }

    for (const [id, overlay] of windows) {
      if (!activeIds.has(id)) {
        overlay.close();
        windows.delete(id);
      }
    }
  }

  return { hideAll, sync };
}

module.exports = { createOverlayController };
