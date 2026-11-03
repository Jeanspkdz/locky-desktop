import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createOverlayController } = require('../../src/main/overlay-controller.cjs');

function createHarness({ attachToBrowser, onAttachFailure, autoReadyToShow = true } = {}) {
  const windows = [];
  const attachments = [];
  class FakeWindow {
    constructor(options) {
      this.options = options;
      this.visible = false;
      this.focused = false;
      this.closed = false;
      this.destroyed = false;
      this.handlers = {};
      this.webContentsHandlers = {};
      this.bounds = { x: options.x, y: options.y, width: options.width, height: options.height };
      this.webContents = {
        send: (channel, value) => { this.lastMessage = { channel, value }; },
        once: (event, handler) => { this.webContentsHandlers[event] = handler; },
      };
      this.id = windows.length + 1;
      windows.push(this);
    }

    loadFile(filePath) {
      this.filePath = filePath;
      if (autoReadyToShow) this.handlers['ready-to-show']?.();
    }
    on(event, handler) { this.handlers[event] = handler; }
    once(event, handler) { this.handlers[event] = handler; }
    showInactive() { this.visible = true; }
    setOpacity(value) { this.opacity = value; }
    setIgnoreMouseEvents(value) { this.ignoreMouseEvents = value; }
    focus() { this.focused = true; }
    isFocused() { return this.focused; }
    hide() { this.visible = false; this.focused = false; }
    setBounds(bounds) { this.bounds = bounds; }
    close() { this.closed = true; this.destroyed = true; this.visible = false; this.handlers.closed?.(); }
    isDestroyed() { return this.destroyed; }
    getNativeWindowHandle() { const handle = Buffer.alloc(8); handle.writeBigUInt64LE(BigInt(this.id)); return handle; }
  }

  const controller = createOverlayController({
    BrowserWindow: FakeWindow,
    ...(attachToBrowser ? { attachToBrowser } : {}),
    ...(onAttachFailure ? { onAttachFailure } : {}),
    preloadPath: 'preload.cjs',
    lockPagePath: 'lock.html',
  });
  return { controller, windows, attachments };
}

test('an active lock covers every visible Chrome, Brave, and Edge window at its own bounds', () => {
  const { controller, windows } = createHarness();
  const browserWindows = [
    { id: 'C1', family: 'chrome', bounds: { x: 15, y: 25, width: 1200, height: 800 }, visible: true },
    { id: 'B1', family: 'brave', bounds: { x: 80, y: 50, width: 1000, height: 700 }, visible: true },
    { id: 'E1', family: 'edge', bounds: { x: -120, y: 0, width: 900, height: 650 }, visible: true },
  ];

  controller.sync({ lockActive: true, browserWindows, remainingMs: 395_000 });

  assert.equal(windows.length, 3);
  assert.deepEqual(windows.map(window => window.visible), [true, true, true]);
  assert.deepEqual(windows.map(window => window.bounds), browserWindows.map(window => window.bounds));
  assert.equal(windows.every(window => window.options.fullscreen !== true), true);
  assert.equal(windows.every(window => window.lastMessage.channel === 'lock:remaining' && window.lastMessage.value === 395_000), true);
  assert.equal(windows.every(window => window.options.alwaysOnTop === false), true);
});

test('a minimized browser hides only its overlay and restoring it shows the remaining time', () => {
  const { controller, windows } = createHarness();
  const chrome = { id: 'C1', family: 'chrome', bounds: { x: 0, y: 0, width: 1200, height: 800 }, visible: true };
  const brave = { id: 'B1', family: 'brave', bounds: { x: 20, y: 20, width: 1000, height: 700 }, visible: true };
  controller.sync({ lockActive: true, browserWindows: [chrome, brave], remainingMs: 200_000 });

  controller.sync({ lockActive: true, browserWindows: [chrome, { ...brave, minimized: true }], remainingMs: 199_000 });
  assert.deepEqual(windows.map(window => window.visible), [true, false]);

  controller.sync({ lockActive: true, browserWindows: [chrome, brave], remainingMs: 198_000 });
  assert.deepEqual(windows.map(window => window.visible), [true, true]);
  assert.equal(windows[1].lastMessage.value, 198_000);
});

test('minimizing and restoring Chrome, Brave, and Edge changes only that browser overlay', () => {
  const { controller, windows } = createHarness();
  const families = ['chrome', 'brave', 'edge'];
  const browserWindows = families.map((family, index) => ({
    id: `${family}-1`,
    family,
    bounds: { x: index * 20, y: index * 15, width: 1000 - index * 50, height: 700 - index * 40 },
    visible: true,
  }));

  controller.sync({ lockActive: true, browserWindows, remainingMs: 300_000 });
  for (let index = 0; index < families.length; index += 1) {
    const minimized = browserWindows.map((window, windowIndex) => ({ ...window, minimized: windowIndex === index }));
    controller.sync({ lockActive: true, browserWindows: minimized, remainingMs: 299_000 - index * 1000 });
    assert.deepEqual(windows.map(window => window.visible), families.map((_family, windowIndex) => windowIndex !== index));

    controller.sync({ lockActive: true, browserWindows, remainingMs: 298_000 - index * 1000 });
    assert.deepEqual(windows.map(window => window.visible), [true, true, true]);
    assert.equal(windows[index].lastMessage.value, 298_000 - index * 1000);
  }
});

test('closing and reopening each protected browser restores only its remaining-time overlay', () => {
  for (const family of ['chrome', 'brave', 'edge']) {
    const { controller, windows } = createHarness();
    const firstWindow = { id: `${family}-1`, family, bounds: { x: 0, y: 0, width: 1000, height: 700 }, visible: true };
    controller.sync({ lockActive: true, browserWindows: [firstWindow], remainingMs: 200_000 });
    controller.sync({ lockActive: true, browserWindows: [], remainingMs: 175_000 });
    assert.equal(windows[0].closed, true, `${family} close removes its overlay`);

    const reopenedWindow = { ...firstWindow, id: `${family}-2` };
    controller.sync({ lockActive: true, browserWindows: [reopenedWindow], remainingMs: 150_000 });
    assert.equal(windows[1].visible, true, `${family} reopen restores an overlay`);
    assert.equal(windows[1].lastMessage.value, 150_000, `${family} uses the shared remaining time`);

    controller.sync({ lockActive: false, browserWindows: [reopenedWindow], remainingMs: 0 });
    assert.equal(windows[1].visible, false, `${family} overlay hides on expiry`);
  }
});

test('closed browsers lose their overlay; new windows are covered; expiry hides all overlays', () => {
  const { controller, windows } = createHarness();
  const chrome = { id: 'C1', family: 'chrome', bounds: { x: 0, y: 0, width: 1200, height: 800 }, visible: true };
  controller.sync({ lockActive: true, browserWindows: [chrome], remainingMs: 60_000 });
  controller.sync({ lockActive: true, browserWindows: [], remainingMs: 59_000 });
  assert.equal(windows[0].closed, true);

  controller.sync({ lockActive: true, browserWindows: [{ ...chrome, id: 'C2' }], remainingMs: 45_000 });
  assert.equal(windows[1].visible, true);
  controller.sync({ lockActive: false, browserWindows: [{ ...chrome, id: 'C2' }], remainingMs: 0 });
  assert.equal(windows[1].visible, false);
});

test('a Brave overlay attachment failure hides the unowned window and reports Brave for repair', async () => {
  const failures = [];
  const { controller, windows } = createHarness({
    attachToBrowser: async () => { throw new Error('window attach failed'); },
    onAttachFailure: (browserWindow, error) => failures.push([browserWindow.family, error.message]),
  });
  controller.sync({
    lockActive: true,
    remainingMs: 100_000,
    browserWindows: [{ id: 'B1', family: 'brave', bounds: { x: 0, y: 0, width: 900, height: 700 }, visible: true }],
  });

  await windows[0].webContentsHandlers['did-finish-load']();
  controller.sync({
    lockActive: true,
    remainingMs: 99_500,
    browserWindows: [{ id: 'B1', family: 'brave', bounds: { x: 0, y: 0, width: 900, height: 700 }, visible: true }],
  });

  assert.equal(windows[0].visible, false);
  assert.deepEqual(failures, [['brave', 'window attach failed']]);
});

test('a lock page load failure never exposes the opaque background', () => {
  const failures = [];
  const { controller, windows } = createHarness({
    onAttachFailure: (browserWindow, error) => failures.push([browserWindow.family, error.message]),
    autoReadyToShow: false,
  });
  const chrome = { id: 'C1', family: 'chrome', bounds: { x: 0, y: 0, width: 1200, height: 800 }, visible: true };
  controller.sync({ lockActive: true, browserWindows: [chrome], remainingMs: 100_000 });

  windows[0].webContentsHandlers['did-fail-load']({}, -6, 'ERR_FILE_NOT_FOUND', 'file:///lock.html', true);
  controller.sync({ lockActive: true, browserWindows: [chrome], remainingMs: 99_500 });

  assert.equal(windows[0].visible, false);
  assert.equal(windows[0].options.paintWhenInitiallyHidden, true);
  assert.deepEqual(failures, [['chrome', 'No se pudo cargar la interfaz de bloqueo (-6): ERR_FILE_NOT_FOUND (file:///lock.html)']]);
});

test('does not display a black overlay before the first rendered frame', async () => {
  let attachments = 0;
  const { controller, windows } = createHarness({
    attachToBrowser: async () => { attachments += 1; },
    autoReadyToShow: false,
  });
  const brave = { id: 'B1', family: 'brave', bounds: { x: 0, y: 0, width: 900, height: 700 }, visible: true };
  controller.sync({ lockActive: true, remainingMs: 100_000, browserWindows: [brave] });
  assert.equal(windows[0].visible, false);

  await windows[0].webContentsHandlers['did-finish-load']();
  controller.sync({ lockActive: true, remainingMs: 99_500, browserWindows: [brave] });
  assert.equal(attachments, 0, 'loading the DOM alone is not proof that the UI has painted');
  assert.equal(windows[0].visible, false);

  await windows[0].handlers['ready-to-show']();
  controller.sync({ lockActive: true, remainingMs: 99_000, browserWindows: [brave] });

  assert.equal(attachments, 1);
  assert.equal(windows[0].visible, true);
});

test('a hidden Electron window can become visible after capturing its first frame', async () => {
  const { controller, windows } = createHarness({ autoReadyToShow: false });
  const brave = { id: 'B1', family: 'brave', bounds: { x: 0, y: 0, width: 900, height: 700 }, visible: true };
  controller.sync({ lockActive: true, remainingMs: 100_000, browserWindows: [brave] });
  let finishCapture;
  windows[0].capturePage = () => {
    return new Promise(resolve => { finishCapture = resolve; });
  };

  const loaded = windows[0].webContentsHandlers['did-finish-load']();
  controller.sync({ lockActive: true, remainingMs: 99_000, browserWindows: [brave] });
  assert.equal(windows[0].visible, true);
  assert.equal(windows[0].opacity, 0);
  assert.equal(windows[0].ignoreMouseEvents, true);

  finishCapture({ isEmpty: () => false });
  await loaded;
  controller.sync({ lockActive: true, remainingMs: 98_000, browserWindows: [brave] });
  assert.equal(windows[0].visible, true);
  assert.equal(windows[0].opacity, 1);
  assert.equal(windows[0].ignoreMouseEvents, false);
});
