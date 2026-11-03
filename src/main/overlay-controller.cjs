function createOverlayController({ BrowserWindow, attachToBrowser, onAttachFailure, preloadPath, lockPagePath }) {
  const windows = new Map();
  const attachedOverlays = new Set();
  const readyOverlays = new Set();
  const stagingOverlays = new Set();
  const lastOverlayState = new Map();

  function createOverlay(browserWindow) {
    const id = String(browserWindow.id);
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
      paintWhenInitiallyHidden: true,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    let pageLoaded = false;
    let firstFrameRendered = false;
    let attachStarted = false;
    let failed = false;
    if (!attachToBrowser) attachedOverlays.add(id);

    function fail(error) {
      if (failed) return;
      failed = true;
      readyOverlays.delete(id);
      attachedOverlays.delete(id);
      stagingOverlays.delete(id);
      if (!overlay.isDestroyed()) overlay.hide();
      onAttachFailure?.(browserWindow, error);
    }

    function attachAfterFirstFrame() {
      if (failed || attachStarted || !pageLoaded || !firstFrameRendered) return undefined;
      if (!attachToBrowser) {
        reveal();
        return undefined;
      }
      attachStarted = true;
      return Promise.resolve().then(() => attachToBrowser(browserWindow.id, overlay)).then(() => {
        if (!overlay.isDestroyed() && !failed) {
          attachedOverlays.add(id);
          reveal();
        }
      }).catch(fail);
    }

    function reveal() {
      if (overlay.isDestroyed() || failed) return;
      stagingOverlays.delete(id);
      overlay.setOpacity?.(1);
      overlay.setIgnoreMouseEvents?.(false);
    }

    function markRendered() {
      firstFrameRendered = true;
      readyOverlays.add(id);
      return attachAfterFirstFrame();
    }

    async function captureFirstFrame() {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        if (overlay.isDestroyed() || failed || firstFrameRendered) return;
        try {
          const image = await overlay.capturePage();
          if (!image.isEmpty()) {
            await markRendered();
            return;
          }
        } catch (error) {
          if (attempt === 9) throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw new Error('Electron no pudo dibujar la interfaz de bloqueo.');
    }

    overlay.once('ready-to-show', () => {
      return markRendered();
    });
    overlay.webContents.once('did-finish-load', () => {
      pageLoaded = true;
      if (firstFrameRendered || typeof overlay.capturePage !== 'function') return attachAfterFirstFrame();
      overlay.setOpacity(0);
      overlay.setIgnoreMouseEvents(true);
      stagingOverlays.add(id);
      overlay.showInactive();
      return captureFirstFrame().catch(fail);
    });
    overlay.webContents.once('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame) return;
      fail(new Error(`No se pudo cargar la interfaz de bloqueo (${errorCode}): ${errorDescription} (${validatedURL})`));
    });
    const loadPromise = overlay.loadFile(lockPagePath);
    Promise.resolve(loadPromise).catch(fail);
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
          readyOverlays.delete(id);
          stagingOverlays.delete(id);
          lastOverlayState.delete(id);
          if (windows.get(id) === overlay) windows.delete(id);
        });
      }

      if (browserWindow.minimized || !browserWindow.visible) {
        overlay.hide();
        continue;
      }
      if (!readyOverlays.has(id) || !attachedOverlays.has(id)) {
        if (!stagingOverlays.has(id)) overlay.hide();
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
