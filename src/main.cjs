const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fsSync = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { execFile } = require('node:child_process');
const { spawn } = require('node:child_process');
const { promisify } = require('node:util');
const { performance } = require('node:perf_hooks');
const { StateStore } = require('./main/state-store.cjs');
const { applyApprovedDomains } = require('./main/approved-domains.cjs');
const { getCandidates } = require('./main/blocklist-provider.cjs');
const { fetchTrustedTime } = require('./main/trusted-time.cjs');
const { createOverlayController } = require('./main/overlay-controller.cjs');
const { createBrowserProcessControl } = require('./main/browser-process-control.cjs');
const { createBrowserProcessScopeReader } = require('./main/browser-process-scope.cjs');
const { createSingleInstanceWindowPresenter } = require('./main/single-instance-window-presenter.cjs');
const { createRetryingBrowserWatcher } = require('./main/retrying-browser-watcher.cjs');
const { createBrowserPollScheduler } = require('./main/browser-poll-scheduler.cjs');
const { createDiagnosticLogger } = require('./main/diagnostic-log.cjs');
const { selectProtectedBrowserFamilies } = require('./domain/protected-browser-families.cjs');
const {
  addPendingRule,
  cancelPendingRule,
  consolidateExpiredRules,
  startDesktopLock,
  remainingLockMs,
} = require('./domain/locky-state.js');
const { getRuntimeConfig } = require('./main/runtime-config.cjs');

const execFileAsync = promisify(execFile);
const runtimeConfig = getRuntimeConfig();
const readBrowserProcessScope = createBrowserProcessScopeReader({
  testMode: runtimeConfig.testMode,
  filePath: runtimeConfig.browserScopeFile,
});
const browserProcessControl = createBrowserProcessControl({
  execute: execFileAsync,
  ...(runtimeConfig.testMode ? { getProcessIds: family => readBrowserProcessScope()[family] ?? [] } : {}),
});
if (runtimeConfig.userDataPath) app.setPath('userData', runtimeConfig.userDataPath);
const diagnosticLogger = createDiagnosticLogger(path.join(app.getPath('userData'), 'locky-diagnostics.log'));
const browserWindowMonitorPath = runtimeConfig.browserWindowMonitorPath
  ?? path.join(process.env.LOCALAPPDATA ?? app.getPath('appData'), 'LockyDesktop', 'browser-window-monitor.exe');
const enforceUnhealthyBrowsers = true;
const PIPE_NAME = `\\\\.\\pipe\\${runtimeConfig.pipeName}`;
let store;
let settingsWindow;
let pipeServer;
let state = null;
let domainRules;
let sessionClock;
let clockRetryTimer;
let browserHealthRules;
let browserWatcherFailed = false;
let lastBrowserFamilies = [];
const browserRuntime = new Map();
const browserWatcher = createRetryingBrowserWatcher(() => require('./main/windows-browser-watcher.cjs').createWindowsBrowserWatcher(undefined, {
  getProcessScope: runtimeConfig.testMode ? readBrowserProcessScope : undefined,
}));
const overlayController = createOverlayController({
  BrowserWindow,
  attachToBrowser: (browserId, overlay) => {
    const overlayHandle = overlay.getNativeWindowHandle().readBigUInt64LE().toString(16);
    return execFileAsync(browserWindowMonitorPath, ['--attach', browserId, overlayHandle], { windowsHide: true, timeout: 1500 });
  },
  onAttachFailure: (browserWindow, error) => {
    diagnosticLogger.error('OVERLAY_ATTACH_FAILURE', error);
    void reportOverlayAttachFailure(browserWindow.family);
  },
  preloadPath: path.join(__dirname, 'preload.cjs'),
  lockPagePath: path.join(__dirname, 'renderer/lock.html'),
});
let timerCheckInProgress = false;

async function reportOverlayAttachFailure(family) {
  if (!browserProcessControl.hasFamily(family)) return;
  await saveAndPublish({
    ...state,
    browserHealth: { ...state.browserHealth, [family]: { status: 'repair', reason: 'overlay' } },
  });
  if (browserHealthRules.shouldEnforceBrowserIntegration(enforceUnhealthyBrowsers, state.rules)) await closeBrowserFamily(family);
}

function createSettingsWindow() {
  settingsWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 760,
    minHeight: 620,
    title: 'Locky Desktop',
    icon: fsSync.existsSync(path.join(process.resourcesPath, 'locky/icon.png'))
      ? path.join(process.resourcesPath, 'locky/icon.png')
      : path.join(__dirname, '../assets/locky.png'),
    autoHideMenuBar: true,
    show: !runtimeConfig.hideSettingsWindow && !process.argv.includes('--background'),
    backgroundColor: '#11151d',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  settingsWindow.loadFile(path.join(__dirname, 'renderer/index.html'));
  settingsWindow.on('closed', () => { settingsWindow = null; });
}

function showSettingsWindow() {
  if (!settingsWindow || settingsWindow.isDestroyed()) createSettingsWindow();
  if (settingsWindow.isMinimized()) settingsWindow.restore();
  settingsWindow.show();
  settingsWindow.focus();
}

const settingsWindowPresenter = createSingleInstanceWindowPresenter(showSettingsWindow);

function syncOverlayVisibility(browserWindows) {
  const remainingMs = remainingLockMs(state?.desktopLock, Date.now());
  overlayController.sync({
    lockActive: remainingMs > 0,
    remainingMs,
    browserWindows,
    suppressed: runtimeConfig.suppressOverlays,
  });
}

function refreshOverlayWindows() {
  const remainingMs = remainingLockMs(state?.desktopLock, Date.now());
  if (remainingMs === 0) {
    overlayController.hideAll();
    return;
  }
  const snapshot = browserWatcher.snapshot();
  const browserWindows = (snapshot.windows ?? []).filter(window => browserProcessControl.hasFamily(window.family)).map(window => ({
    ...window,
    bounds: { x: window.x, y: window.y, width: window.width, height: window.height },
  }));
  syncOverlayVisibility(browserWindows);
}

const browserPollScheduler = createBrowserPollScheduler({
  detectBrowsers: checkTimers,
  trackWindows: refreshOverlayWindows,
  isLockActive: () => remainingLockMs(state?.desktopLock, Date.now()) > 0,
  onWindowTrackingError: error => diagnosticLogger.error('OVERLAY_TRACKING_FAILURE', error),
  onLockInactive: () => overlayController.hideAll(),
});

async function closeBrowsers() {
  await browserProcessControl.closeProtectedBrowsers();
}

async function closeBrowserFamily(family) {
  await browserProcessControl.closeFamily(family);
}

async function saveAndPublish(nextState) {
  const previousState = state;
  const rulesChanged = previousState && nextState.rules !== previousState.rules;
  const publishedState = {
    ...nextState,
    revision: (previousState?.revision ?? 0) + 1,
    rulesRevision: (previousState?.rulesRevision ?? 0) + (rulesChanged ? 1 : 0),
  };
  state = publishedState;
  try {
    await store.write(publishedState);
  } catch (error) {
    if (state === publishedState) state = previousState;
    diagnosticLogger.error('STATE_WRITE_FAILURE', error);
    throw error;
  }
  if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.webContents.send('state:changed', publicState());
}

function publicState() {
  const visibleState = { ...state };
  const ruleCount = visibleState.rules.length;
  for (const key of [
    'rules',
    'candidateList',
    'candidateListApproved',
    'candidateListApprovedAt',
    'candidateListCheckedAt',
  ]) delete visibleState[key];
  return {
    ...visibleState,
    ruleCount,
    clockReady: Boolean(sessionClock?.ready),
    clockNow: sessionClock?.now() ?? null,
    enforcementEnabled: browserHealthRules.shouldEnforceBrowserIntegration(enforceUnhealthyBrowsers, state.rules),
  };
}

async function checkTimers() {
  if (timerCheckInProgress || !state) return;
  timerCheckInProgress = true;
  try {
    const now = sessionClock?.now();
    if (now !== null && now !== undefined) {
      const nextState = consolidateExpiredRules(state, now);
      if (nextState !== state) await saveAndPublish(nextState);
    }
    let snapshot;
    try {
      snapshot = browserWatcher.snapshot();
    } catch (error) {
      await handleBrowserWatcherFailure(error);
      return;
    }
    const detectedFamilies = selectProtectedBrowserFamilies((snapshot.windows ?? []).map(window => window.family));
    lastBrowserFamilies = detectedFamilies;
    if (browserWatcherFailed) {
      browserWatcherFailed = false;
      const browserHealth = { ...state.browserHealth };
      for (const [family, value] of Object.entries(browserHealth)) {
        if (value.reason !== 'watcher') continue;
        if (!detectedFamilies.includes(family)) {
          browserHealth[family] = { status: 'idle' };
          continue;
        }
        const runtime = browserRuntime.get(family);
        const failure = runtime && browserHealthRules.integrationFailureReason(runtime, performance.now());
        browserHealth[family] = failure
          ? { status: 'repair', reason: failure }
          : runtime
            ? { status: 'healthy' }
            : { status: 'checking' };
      }
      await saveAndPublish({ ...state, browserHealth });
    }
    const nowMono = performance.now();
    for (const [family] of browserRuntime) {
      if (detectedFamilies.includes(family)) continue;
      browserRuntime.delete(family);
      if (state.browserHealth[family]?.status !== 'idle' && state.browserHealth[family]?.status !== 'repair') {
        await saveAndPublish({ ...state, browserHealth: { ...state.browserHealth, [family]: { status: 'idle' } } });
      }
    }
    for (const family of detectedFamilies) {
      let runtime = browserRuntime.get(family);
      if (!runtime) {
        runtime = browserHealthRules.createBrowserRuntime(nowMono);
        browserRuntime.set(family, runtime);
        await saveAndPublish({ ...state, browserHealth: { ...state.browserHealth, [family]: { status: 'checking' } } });
      }
      const integration = browserHealthRules.evaluateBrowserIntegration(runtime, nowMono, enforceUnhealthyBrowsers, state.rules);
      const failure = integration.failure;
      if (failure) {
        const current = state.browserHealth[family];
        if (current?.status !== 'repair' || current.reason !== failure) {
          await saveAndPublish({ ...state, browserHealth: { ...state.browserHealth, [family]: { status: 'repair', reason: failure } } });
        }
        if (integration.closeBrowser) await closeBrowserFamily(family);
      }
    }
    if (state.desktopLock && remainingLockMs(state.desktopLock, Date.now()) === 0) {
      await saveAndPublish({ ...state, desktopLock: null });
      browserPollScheduler.stopWindowTracking();
      overlayController.hideAll();
    }
  } catch (error) {
    console.error('No se pudo actualizar el estado de protección.', error);
  } finally {
    timerCheckInProgress = false;
  }
}

async function handleBrowserWatcherFailure(error) {
  if (browserWatcherFailed) return;
  browserWatcherFailed = true;
  const familiesToRepair = browserProcessControl.familiesForWatcherFailure(lastBrowserFamilies);
  console.error('Falló el vigilante de navegadores.', error);
  diagnosticLogger.error('BROWSER_WATCHER_FAILURE', error);
  if (browserHealthRules.shouldEnforceBrowserIntegration(enforceUnhealthyBrowsers, state.rules)) {
    await Promise.all(familiesToRepair.map(closeBrowserFamily));
  }
  const browserHealth = { ...state.browserHealth };
  for (const family of familiesToRepair) {
    browserHealth[family] = { status: 'repair', reason: 'watcher' };
  }
  await saveAndPublish({ ...state, browserHealth }).catch(persistError => {
    console.error('No se pudo guardar el estado de reparación del vigilante.', persistError);
  });
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send('state:changed', publicState());
  }
}

function sendPipeResponse(socket, message) {
  if (!socket.writable) return;
  socket.write(`${JSON.stringify(message)}\n`);
}

function startPipeServer() {
  pipeServer = net.createServer(socket => {
    socket.on('error', error => {
      if (error.code === 'EPIPE' || error.code === 'ECONNRESET') return;
      diagnosticLogger.error('NATIVE_PIPE_SOCKET_FAILURE', error);
    });
    let buffer = '';
    socket.on('data', chunk => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        let request;
        try { request = JSON.parse(line); } catch { continue; }
        void handleNativeMessage(request).then(response => sendPipeResponse(socket, { id: request.id, ...response })).catch(error => {
          diagnosticLogger.error('NATIVE_MESSAGE_FAILURE', error);
          sendPipeResponse(socket, { id: request.id, ok: false, error: 'Locky no pudo procesar la solicitud del navegador.' });
        });
      }
    });
  });
  pipeServer.on('error', () => {});
  pipeServer.listen(PIPE_NAME);
}

async function handleNativeMessage(message) {
  if (message.type === 'getState') {
    const offset = Number.isSafeInteger(message.offset) && message.offset >= 0 ? message.offset : 0;
    const limit = Number.isSafeInteger(message.limit) && message.limit >= 0 ? Math.min(message.limit, 500) : 500;
    return {
      ok: true,
      type: 'state',
      rules: limit === 0 ? [] : state.rules.slice(offset, offset + limit),
      offset,
      limit,
      totalRules: state.rules.length,
      rulesRevision: state.rulesRevision,
      version: state.version,
      clockReady: Boolean(sessionClock?.ready),
    };
  }
  if (message.type === 'blocked') {
    if (!domainRules.findMatchingRule(message.url, state.rules)) return { ok: false, error: 'La URL no coincide con una regla consolidada.' };
    await saveAndPublish({
      ...state,
      desktopLock: startDesktopLock(state.desktopLock, Date.now(), runtimeConfig.lockPeriodMs ?? undefined),
    });
    browserPollScheduler.startWindowTracking();
    return { ok: true };
  }
  if (message.type === 'connected') {
    const family = message.browserFamily;
    if (!browserProcessControl.hasFamily(family)) return { ok: false, error: 'Navegador no reconocido por Locky.' };
    const runtime = browserRuntime.get(family) ?? {
      ...browserHealthRules.createBrowserRuntime(performance.now()),
    };
    runtime.lastConnectedAt = performance.now();
    browserRuntime.set(family, runtime);
    if (state.browserHealth[family]?.status !== 'healthy' && state.browserHealth[family]?.status !== 'checking') {
      await saveAndPublish({ ...state, browserHealth: { ...state.browserHealth, [family]: { status: 'checking' } } });
    }
    return { ok: true };
  }
  if (message.type === 'health') {
    const family = message.browserFamily;
    if (!browserProcessControl.hasFamily(family)) return { ok: false, error: 'Navegador no reconocido por Locky.' };
    const runtime = browserRuntime.get(family) ?? { startedAt: performance.now(), lastHealthyAt: null };
    if (message.ok === true) {
      runtime.lastHealthyAt = performance.now();
      browserRuntime.set(family, runtime);
      const browserHealth = { ...state.browserHealth, [family]: { status: 'healthy' } };
      if (state.browserHealth[family]?.status !== 'healthy') await saveAndPublish({ ...state, browserHealth });
      return { ok: true };
    }
    runtime.startedAt = 0;
    runtime.lastHealthyAt = null;
    runtime.lastConnectedAt = null;
    browserRuntime.set(family, runtime);
    await saveAndPublish({ ...state, browserHealth: { ...state.browserHealth, [family]: { status: 'repair', reason: 'extension' } } });
    if (browserHealthRules.shouldEnforceBrowserIntegration(enforceUnhealthyBrowsers, state.rules)) await closeBrowserFamily(family);
    return { ok: true };
  }
  return { ok: false, error: 'Solicitud desconocida' };
}

function registerIpc() {
  ipcMain.handle('state:get', () => publicState());
  ipcMain.handle('dns-protection:status', async () => {
    if (process.platform !== 'win32') return { installed: false, running: false, supported: false };
    try {
      const { stdout } = await execFileAsync('sc.exe', ['query', 'LockyDnsProtection'], { windowsHide: true });
      const stateMatch = stdout.match(/STATE\s*:\s*(\d+)/i);
      return { installed: true, running: stateMatch?.[1] === '4', supported: true };
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 1060 || /does not exist|no existe/i.test(`${error.message} ${error.stderr ?? ''}`)) {
        return { installed: false, running: false, supported: true };
      }
      return { installed: true, running: false, supported: true };
    }
  });
  ipcMain.handle('rules:add', async (_event, input) => {
    if (!sessionClock?.ready) throw new Error('Conecta el equipo a internet para iniciar un período de verificación con hora confirmada.');
    const rule = domainRules.normalizeRule(input);
    const allRules = [...state.rules, ...state.pendingRules];
    domainRules.assertRuleCapacity(allRules, rule);
    const duplicate = [...state.rules, ...state.pendingRules].some(existing => existing.type === rule.type && existing.host === rule.host && existing.path === rule.path);
    if (duplicate) throw new Error('Esa regla ya existe o está pendiente.');
    const next = addPendingRule(state, { ...rule, id: crypto.randomUUID() }, sessionClock.now());
    await saveAndPublish(next);
    return next;
  });
  ipcMain.handle('rules:cancel', async (_event, ruleId) => {
    if (!sessionClock?.ready) throw new Error('Conecta el equipo a internet para confirmar si el período de verificación sigue abierto.');
    const withExpired = consolidateExpiredRules(state, sessionClock.now());
    const next = cancelPendingRule(withExpired, ruleId);
    await saveAndPublish(next);
    return next;
  });
  ipcMain.handle('browsers:close', async () => {
    await closeBrowsers();
    overlayController.hideAll();
    return true;
  });
  ipcMain.handle('runtime:is-packaged', () => app.isPackaged);
  ipcMain.handle('lock:demo', async () => {
    if (!sessionClock?.ready) throw new Error('Conecta el equipo a internet para simular el período de bloqueo.');
    const rule = state.rules[0];
    if (!rule) throw new Error('Agrega primero una regla consolidada.');
    return handleNativeMessage({ type: 'blocked', url: rule.type === 'domain' ? `https://${rule.host}/` : `https://${rule.host}${rule.path}` });
  });
}

async function synchronizeClock() {
  const trustedUtcMs = await fetchTrustedTime();
  if (trustedUtcMs === null) {
    if (!clockRetryTimer) clockRetryTimer = setInterval(() => void synchronizeClock(), 15_000);
    if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.webContents.send('state:changed', publicState());
    await checkTimers();
    return;
  }
  if (!sessionClock.ready) {
    sessionClock.anchor(trustedUtcMs);
    if (clockRetryTimer) clearInterval(clockRetryTimer);
    clockRetryTimer = null;
    await checkTimers();
  }
}

function writeNativeReply(message) {
  const payload = Buffer.from(JSON.stringify(message), 'utf8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(payload.length, 0);
  process.stdout.write(Buffer.concat([header, payload]));
}

function startDesktopProcess() {
  const args = app.isPackaged ? ['--background'] : [app.getAppPath(), '--background'];
  const child = spawn(process.execPath, args, { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
}

function forwardNativeRequest(message, allowStart = true) {
  return new Promise(resolve => {
    let buffer = '';
    let settled = false;
    let attempts = 0;
    let socket;
    const finish = value => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      socket?.destroy();
      resolve(value);
    };
    const timeout = setTimeout(() => finish({ ok: false, error: 'Locky Desktop no responde.' }), 5000);
    const connect = () => {
      if (settled) return;
      attempts += 1;
      socket = net.connect(PIPE_NAME);
      socket.once('connect', () => socket.write(`${JSON.stringify(message)}\n`));
      socket.on('data', chunk => {
        buffer += chunk.toString('utf8');
        const lineEnd = buffer.indexOf('\n');
        if (lineEnd < 0) return;
        clearTimeout(timeout);
        try { finish(JSON.parse(buffer.slice(0, lineEnd))); }
        catch { finish({ ok: false, error: 'Respuesta local no válida.' }); }
      });
      socket.once('error', () => {
        socket.destroy();
        if (attempts === 1 && allowStart) {
          try { startDesktopProcess(); } catch {}
        }
        if (attempts >= 16) {
          finish({ ok: false, error: 'Locky Desktop no está iniciado.' });
          return;
        }
        setTimeout(connect, 250);
      });
    };
    connect();
  });
}

function runNativeHost() {
  let input = Buffer.alloc(0);
  process.stdin.on('data', chunk => {
    input = Buffer.concat([input, chunk]);
    while (input.length >= 4) {
      const size = input.readUInt32LE(0);
      if (input.length < size + 4) return;
      const payload = input.subarray(4, size + 4);
      input = input.subarray(size + 4);
      let message;
      try { message = JSON.parse(payload.toString('utf8')); }
      catch { writeNativeReply({ ok: false, error: 'Mensaje no válido.' }); continue; }
      void forwardNativeRequest(message).then(writeNativeReply);
    }
  });
  process.stdin.on('end', () => process.exit(0));
}

if (process.argv.includes('--native-host')) {
  runNativeHost();
} else {
  const hasSingleInstanceLock = app.requestSingleInstanceLock();
  if (!hasSingleInstanceLock) {
    app.quit();
  } else app.whenReady().then(async () => {
    domainRules = await import('./domain/rules.js');
    browserHealthRules = await import('./domain/browser-health.js');
    store = new StateStore(path.join(app.getPath('userData'), 'locky-state.json'));
    state = await store.read();
    const resetHealth = browserHealthRules.resetBrowserHealthForStartup(state.browserHealth);
    if (JSON.stringify(resetHealth) !== JSON.stringify(state.browserHealth)) {
      await saveAndPublish({ ...state, browserHealth: resetHealth });
    }
    const blocklist = await getCandidates();
    const approvedState = applyApprovedDomains(state, blocklist.candidates, blocklist.checkedAt);
    domainRules.assertRuleSetCapacity([...approvedState.rules, ...approvedState.pendingRules]);
    if (JSON.stringify(approvedState) !== JSON.stringify(state)) await saveAndPublish(approvedState);
    sessionClock = new (await import('./domain/session-clock.js')).SessionClock();
    registerIpc();
    startPipeServer();
    createSettingsWindow();
    settingsWindowPresenter.markReady();
    browserPollScheduler.start();
    void synchronizeClock();
  }).catch(error => {
    dialog.showErrorBox('Locky no pudo iniciar', `${error.message}\n\nSe conserva el archivo de estado para no descartar reglas permanentes.`);
    app.quit();
  });
  app.on('second-instance', () => settingsWindowPresenter.request());
  app.on('window-all-closed', () => {});
}

app.on('before-quit', () => {
  browserPollScheduler.stop();
  clearInterval(clockRetryTimer);
  pipeServer?.close();
});
