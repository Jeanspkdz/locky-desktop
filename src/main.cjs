const { app, BrowserWindow, dialog, ipcMain, screen } = require('electron');
const fsSync = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { execFile } = require('node:child_process');
const { spawn } = require('node:child_process');
const { promisify } = require('node:util');
const { performance } = require('node:perf_hooks');
const { StateStore } = require('./main/state-store.cjs');
const { getCandidates } = require('./main/blocklist-provider.cjs');
const { fetchTrustedTime } = require('./main/trusted-time.cjs');
const {
  addPendingRule,
  cancelPendingRule,
  consolidateExpiredRules,
  startDesktopLock,
  remainingLockMs,
} = require('./domain/locky-state.js');

const execFileAsync = promisify(execFile);
const installedMarker = path.join(process.resourcesPath, 'locky', 'installed.flag');
const enforceUnhealthyBrowsers = app.isPackaged || fsSync.existsSync(installedMarker)
  || process.env.LOCKY_ENFORCE_UNHEALTHY_BROWSER === '1';
const PIPE_NAME = '\\\\.\\pipe\\locky-desktop';
const BROWSER_NAMES = ['chrome.exe', 'brave.exe', 'msedge.exe', 'firefox.exe', 'opera.exe', 'opera_gx.exe'];
let store;
let settingsWindow;
let overlayWindows = new Map();
let pipeServer;
let monitorTimer;
let state = null;
let domainRules;
let sessionClock;
let clockRetryTimer;
let unverifiedLockStartedMono = null;
let browserHealthRules;
const BROWSER_PROCESS_GROUPS = Object.freeze({
  chrome: ['chrome.exe'],
  brave: ['brave.exe'],
  edge: ['msedge.exe'],
  firefox: ['firefox.exe'],
  opera: ['opera.exe', 'opera_gx.exe'],
});
const browserRuntime = new Map();

function createSettingsWindow() {
  settingsWindow = new BrowserWindow({
    width: 980,
    height: 760,
    minWidth: 760,
    minHeight: 620,
    title: 'Locky Desktop',
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

function createOverlay(display) {
  const key = `${display.id}`;
  if (overlayWindows.has(key)) return overlayWindows.get(key);
  const win = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    fullscreen: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#10131b',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.loadFile(path.join(__dirname, 'renderer/lock.html'));
  win.on('closed', () => overlayWindows.delete(key));
  overlayWindows.set(key, win);
  return win;
}

function syncOverlayVisibility(browserRunning) {
  const lockActive = state?.desktopLock?.unverified === true
    || (sessionClock?.ready && remainingLockMs(state?.desktopLock, sessionClock.now()) > 0);
  if (!lockActive || !browserRunning) {
    for (const win of overlayWindows.values()) if (!win.isDestroyed()) win.hide();
    return;
  }

  const displays = screen.getAllDisplays();
  const activeIds = new Set(displays.map(display => `${display.id}`));
  for (const display of displays) createOverlay(display).show();
  for (const [id, win] of overlayWindows) {
    if (!activeIds.has(id)) {
      win.close();
      overlayWindows.delete(id);
    }
  }
}

async function runningBrowserFamilies() {
  try {
    const { stdout } = await execFileAsync('tasklist.exe', ['/FO', 'CSV', '/NH'], { windowsHide: true });
    const running = new Set([...stdout.matchAll(/"([^",]+\.exe)"/gi)].map(match => match[1].toLowerCase()));
    return Object.entries(BROWSER_PROCESS_GROUPS)
      .filter(([, names]) => names.some(name => running.has(name)))
      .map(([family]) => family);
  } catch {
    return null;
  }
}

async function closeBrowsers() {
  for (const name of BROWSER_NAMES) {
    await execFileAsync('taskkill.exe', ['/IM', name, '/T', '/F'], { windowsHide: true }).catch(() => {});
  }
}

async function closeBrowserFamily(family) {
  for (const name of BROWSER_PROCESS_GROUPS[family] ?? []) {
    await execFileAsync('taskkill.exe', ['/IM', name, '/T', '/F'], { windowsHide: true }).catch(() => {});
  }
}

async function saveAndPublish(nextState) {
  const rulesChanged = state && nextState.rules !== state.rules;
  state = {
    ...nextState,
    revision: (state?.revision ?? 0) + 1,
    rulesRevision: (state?.rulesRevision ?? 0) + (rulesChanged ? 1 : 0),
  };
  await store.write(state);
  if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.webContents.send('state:changed', publicState());
}

function publicState() {
  return {
    ...state,
    clockReady: Boolean(sessionClock?.ready),
    clockNow: sessionClock?.now() ?? null,
    enforcementEnabled: enforceUnhealthyBrowsers,
  };
}

async function checkTimers() {
  const now = sessionClock?.now();
  if (now !== null && now !== undefined) {
    const nextState = consolidateExpiredRules(state, now);
    if (nextState !== state) await saveAndPublish(nextState);
  }
  const detectedFamilies = await runningBrowserFamilies();
  const runningFamilies = detectedFamilies ?? [...browserRuntime.keys()];
  const nowMono = performance.now();
  for (const [family] of browserRuntime) {
    if (runningFamilies.includes(family)) continue;
    browserRuntime.delete(family);
    if (detectedFamilies !== null && state.browserHealth[family]?.status !== 'idle' && state.browserHealth[family]?.status !== 'repair') {
      await saveAndPublish({ ...state, browserHealth: { ...state.browserHealth, [family]: { status: 'idle' } } });
    }
  }
  for (const family of detectedFamilies ?? []) {
    let runtime = browserRuntime.get(family);
    if (!runtime) {
      runtime = { startedAt: nowMono, lastHealthyAt: null };
      browserRuntime.set(family, runtime);
      await saveAndPublish({ ...state, browserHealth: { ...state.browserHealth, [family]: { status: 'checking' } } });
    }
    const failure = browserHealthRules.integrationFailureReason(runtime, nowMono);
    if (failure) {
      const current = state.browserHealth[family];
      if (current?.status !== 'repair' || current.reason !== failure) {
        await saveAndPublish({ ...state, browserHealth: { ...state.browserHealth, [family]: { status: 'repair', reason: failure } } });
      }
      if (enforceUnhealthyBrowsers) await closeBrowserFamily(family);
    }
  }
  syncOverlayVisibility(runningFamilies.length > 0);
  if (now !== null && now !== undefined && state.desktopLock && !state.desktopLock.unverified && remainingLockMs(state.desktopLock, now) === 0) {
    await saveAndPublish({ ...state, desktopLock: null });
    for (const win of overlayWindows.values()) if (!win.isDestroyed()) win.hide();
  }
}

function sendPipeResponse(socket, message) {
  socket.write(`${JSON.stringify(message)}\n`);
}

function startPipeServer() {
  pipeServer = net.createServer(socket => {
    let buffer = '';
    socket.on('data', chunk => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        let request;
        try { request = JSON.parse(line); } catch { continue; }
        void handleNativeMessage(request).then(response => sendPipeResponse(socket, { id: request.id, ...response }));
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
    if (!sessionClock?.ready) {
      if (!state.desktopLock) unverifiedLockStartedMono = performance.now();
      await saveAndPublish({ ...state, desktopLock: state.desktopLock ?? { unverified: true } });
    } else {
      await saveAndPublish({ ...state, desktopLock: startDesktopLock(state.desktopLock, sessionClock.now()) });
    }
    await checkTimers();
    return { ok: true };
  }
  if (message.type === 'health') {
    const family = message.browserFamily;
    if (!Object.hasOwn(BROWSER_PROCESS_GROUPS, family)) return { ok: false, error: 'Navegador no reconocido por Locky.' };
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
    browserRuntime.set(family, runtime);
    await saveAndPublish({ ...state, browserHealth: { ...state.browserHealth, [family]: { status: 'repair', reason: 'extension' } } });
    if (enforceUnhealthyBrowsers) await closeBrowserFamily(family);
    return { ok: true };
  }
  return { ok: false, error: 'Solicitud desconocida' };
}

function registerIpc() {
  ipcMain.handle('state:get', () => publicState());
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
  ipcMain.handle('candidates:refresh', async () => {
    const result = await getCandidates();
    const currentHosts = new Set([...state.rules, ...state.pendingRules].filter(rule => rule.type === 'domain').map(rule => rule.host));
    const candidates = result.candidates.filter(candidate => !currentHosts.has(candidate.domain));
    const next = { ...state, candidateList: candidates, candidateListCheckedAt: result.checkedAt };
    await saveAndPublish(next);
    return { ...result, candidates };
  });
  ipcMain.handle('candidates:approve', async () => {
    const byHost = new Map([...state.rules, ...state.pendingRules].filter(rule => rule.type === 'domain').map(rule => [rule.host, rule]));
    const additions = state.candidateList.filter(candidate => !byHost.has(candidate.domain));
    const rules = additions.map(candidate => ({
      id: crypto.randomUUID(),
      type: 'domain',
      host: candidate.domain,
      path: '/',
      source: 'preset',
      categories: candidate.categories,
    }));
    domainRules.assertRuleSetCapacity([...state.rules, ...state.pendingRules, ...rules]);
    const next = { ...state, rules: [...state.rules, ...rules], candidateListApproved: true, candidateList: [] };
    await saveAndPublish(next);
    return next;
  });
  ipcMain.handle('browsers:close', async () => {
    await closeBrowsers();
    for (const win of overlayWindows.values()) if (!win.isDestroyed()) win.hide();
    return true;
  });
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
    if (state.desktopLock?.unverified) {
      const elapsed = unverifiedLockStartedMono === null ? 0 : performance.now() - unverifiedLockStartedMono;
      const remaining = Math.max(0, 7 * 60 * 1000 - elapsed);
      await saveAndPublish({ ...state, desktopLock: remaining > 0 ? { startedAt: sessionClock.now() - elapsed, endsAt: sessionClock.now() + remaining } : null });
    }
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
  const args = app.isPackaged ? [] : [app.getAppPath()];
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
    sessionClock = new (await import('./domain/session-clock.js')).SessionClock();
    registerIpc();
    startPipeServer();
    createSettingsWindow();
    screen.on('display-added', () => void checkTimers());
    screen.on('display-removed', () => void checkTimers());
    monitorTimer = setInterval(() => void checkTimers(), 1000);
    void checkTimers();
    void synchronizeClock();
  }).catch(error => {
    dialog.showErrorBox('Locky no pudo iniciar', `${error.message}\n\nSe conserva el archivo de estado para no descartar reglas permanentes.`);
    app.quit();
  });
}

app.on('before-quit', () => {
  clearInterval(monitorTimer);
  clearInterval(clockRetryTimer);
  pipeServer?.close();
});
