const { spawn, execFileSync } = require('node:child_process');
const nodeAssert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { snapshotWindows } = require('./browser-e2e-windows.cjs');

const projectRoot = path.resolve(__dirname, '..');
const blockedHost = 'pornhub.com';
const EXTENSION_PATH = path.join(projectRoot, 'extensions', 'chromium');
const EXTENSION_ID = 'pgphggplmacpiglkndjhpaojeeoomfdn';
let testMarkerHost = '';
const BROWSER_SPECS = [
  {
    family: 'chrome',
    label: 'Chrome',
    executableNames: ['chrome.exe'],
    executablePaths: [
      path.join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ],
  },
  {
    family: 'brave',
    label: 'Brave',
    executableNames: ['brave.exe'],
    executablePaths: [
      path.join(process.env.ProgramFiles ?? 'C:\\Program Files', 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
      path.join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
    ],
  },
  {
    family: 'edge',
    label: 'Edge',
    executableNames: ['msedge.exe'],
    executablePaths: [
      path.join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ],
  },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function log(message) {
  process.stdout.write(`[browser-lifecycle] ${message}\n`);
}

function findExecutable(spec) {
  const executable = spec.executablePaths.find(candidate => fs.existsSync(candidate));
  assert(executable, `Installed ${spec.label} executable was not found.`);
  return executable;
}

function findElectronBinary() {
  const configured = process.env.LOCKY_E2E_ELECTRON;
  if (configured && fs.existsSync(configured)) return configured;
  try {
    const resolved = require('electron');
    if (typeof resolved === 'string' && fs.existsSync(resolved)) return resolved;
  } catch {}
  const local = path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
  assert(fs.existsSync(local), 'Install the project dependencies with pnpm before running the browser smoke.');
  return local;
}

function verifyNativeHostRegistration() {
  const localAppData = process.env.LOCALAPPDATA;
  assert(localAppData, 'LOCALAPPDATA is unavailable.');
  const manifestPath = path.join(localAppData, 'LockyDesktop', 'com.locky.desktop.json');
  assert(fs.existsSync(manifestPath), 'The registered Chromium native host manifest is missing.');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert(fs.existsSync(manifest.path), 'The registered Chromium native host executable is missing.');
  assert(manifest.allowed_origins?.includes(`chrome-extension://${EXTENSION_ID}/`), 'The registered native host does not allow this extension.');
  for (const browserPath of [
    'HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\com.locky.desktop',
    'HKCU\\Software\\BraveSoftware\\Brave-Browser\\NativeMessagingHosts\\com.locky.desktop',
    'HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\com.locky.desktop',
  ]) {
    execFileSync('reg.exe', ['query', browserPath, '/ve'], { windowsHide: true, stdio: 'ignore' });
  }
  const monitorPath = path.join(localAppData, 'LockyDesktop', 'browser-window-monitor.exe');
  assert(fs.existsSync(monitorPath), 'The installed browser window monitor is missing.');
}

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = netServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(error => error ? reject(error) : resolve(port));
    });
  });
}

function netServer() {
  return require('node:net').createServer();
}

async function waitFor(description, predicate, timeoutMs = 20_000, intervalMs = 250) {
  const startedAt = Date.now();
  let lastError;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const value = await predicate();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await delay(intervalMs);
  }
  const detail = lastError ? `: ${lastError.message}` : '';
  throw new Error(`Timed out waiting for ${description}${detail}`);
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function cdpConnect(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  const pending = new Map();
  let nextId = 0;
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', event => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    clearTimeout(request.timeout);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });
  socket.addEventListener('close', () => {
    for (const request of pending.values()) {
      clearTimeout(request.timeout);
      request.reject(new Error('DevTools connection closed.'));
    }
    pending.clear();
  });
  return {
    socket,
    send(method, params = {}, sessionId = null) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`DevTools request timed out: ${method}`));
        }, 5000);
        pending.set(id, { resolve, reject, timeout });
        socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close() { socket.close(); },
  };
}

function cdpPipeConnect(child) {
  const outgoing = child.stdio[3];
  const incoming = child.stdio[4];
  assert(outgoing && incoming, 'Chrome DevTools pipe was not created.');
  const pending = new Map();
  let nextId = 0;
  let buffer = '';
  incoming.setEncoding('utf8');
  incoming.on('data', chunk => {
    buffer += chunk;
    let terminator = buffer.indexOf('\0');
    while (terminator >= 0) {
      const raw = buffer.slice(0, terminator);
      buffer = buffer.slice(terminator + 1);
      terminator = buffer.indexOf('\0');
      let message;
      try { message = JSON.parse(raw); } catch { continue; }
      const request = pending.get(message.id);
      if (!request) continue;
      pending.delete(message.id);
      clearTimeout(request.timeout);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
    }
  });
  const closePending = () => {
    for (const request of pending.values()) {
      clearTimeout(request.timeout);
      request.reject(new Error('DevTools pipe closed.'));
    }
    pending.clear();
  };
  incoming.once('close', closePending);
  incoming.once('error', closePending);
  return {
    send(method, params = {}, sessionId = null) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`DevTools request timed out: ${method}`));
        }, 10_000);
        pending.set(id, { resolve, reject, timeout });
        outgoing.write(`${JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })}\0`, error => {
          if (!error) return;
          pending.delete(id);
          clearTimeout(timeout);
          reject(error);
        });
      });
    },
    close() {
      outgoing.end();
      incoming.destroy();
      closePending();
    },
  };
}

async function waitForDevTools(port) {
  const version = await waitFor(`DevTools on port ${port}`, async () => {
    try { return await fetchJson(`http://127.0.0.1:${port}/json/version`); }
    catch { return null; }
  }, 30_000);
  const connection = await cdpConnect(version.webSocketDebuggerUrl);
  return { connection, port };
}

async function listAppTargets(port) {
  return fetchJson(`http://127.0.0.1:${port}/json/list`);
}

async function closeSettingsWindow(appDevTools) {
  const targets = await listAppTargets(appDevTools.port);
  const settingsTarget = targets.find(target => target.type === 'page' && target.title === 'Locky Desktop');
  assert(settingsTarget, 'The isolated Locky settings window is not available to close.');
  const result = await appDevTools.connection.send('Target.closeTarget', { targetId: settingsTarget.id });
  assert(result.success, 'The isolated Locky settings window did not close.');
  await waitFor('the isolated Locky settings window to close', async () => (
    !(await listAppTargets(appDevTools.port)).some(target => target.type === 'page' && target.title === 'Locky Desktop')
  ));
}

async function openSettingsWithSecondInstance(electronBinary, testEnv, appDevTools, secondInstance) {
  secondInstance.child = spawn(electronBinary, [projectRoot], {
    cwd: projectRoot,
    env: testEnv,
    stdio: 'ignore',
    windowsHide: true,
  });
  secondInstance.child.once('error', error => { secondInstance.child.startError = error; });
  await waitFor('the second Locky instance to reopen the settings window', async () => {
    if (secondInstance.child.startError) throw secondInstance.child.startError;
    const targets = await listAppTargets(appDevTools.port);
    const settingsOpen = targets.some(target => target.type === 'page' && target.title === 'Locky Desktop');
    const secondInstanceExited = secondInstance.child.exitCode !== null || secondInstance.child.signalCode !== null;
    return settingsOpen && secondInstanceExited ? true : null;
  }, 20_000);
}

async function readOverlayCountdowns(appDevTools, expectedCount) {
  const targets = await waitFor('Locky lock page targets', async () => {
    const lockTargets = (await listAppTargets(appDevTools.port))
      .filter(target => target.type === 'page' && target.title === 'Bloqueo activado');
    return lockTargets.length >= expectedCount ? lockTargets : null;
  }, 20_000);
  const values = await Promise.all(targets.map(async target => {
    const page = await cdpConnect(target.webSocketDebuggerUrl);
    try {
      await page.send('Runtime.enable');
      const result = await page.send('Runtime.evaluate', {
        expression: 'document.querySelector("#remaining-time")?.textContent ?? ""',
        returnByValue: true,
      });
      const match = /^(\d{2}):(\d{2})$/.exec(result.result.value);
      return match ? { id: target.id, seconds: Number(match[1]) * 60 + Number(match[2]) } : null;
    } finally {
      page.close();
    }
  }));
  return values.every(Boolean) ? values : null;
}

async function getPageTarget(browser) {
  const targets = await waitFor('an installed browser page target', async () => {
    try {
      const { targetInfos } = await browser.browserDevTools.connection.send('Target.getTargets');
      const pages = targetInfos.filter(target => target.type === 'page' && !target.url?.startsWith('chrome-extension://'));
      return pages.length ? pages : null;
    } catch { return null; }
  });
  return targets[0];
}

async function connectPage(browser) {
  const target = await getPageTarget(browser);
  const { sessionId } = await browser.browserDevTools.connection.send('Target.attachToTarget', {
    targetId: target.targetId,
    flatten: true,
  });
  const connection = browser.browserDevTools.connection;
  const page = {
    send: (method, params = {}) => connection.send(method, params, sessionId),
    close: () => connection.send('Target.detachFromTarget', { sessionId }).catch(() => {}),
  };
  await page.send('Page.enable');
  await page.send('Network.enable');
  return { page, target };
}

async function extensionWorkerIdentity(browser) {
  return waitFor(`${browser.spec.label} extension worker initialization`, async () => {
    const { targetInfos } = await browser.browserDevTools.connection.send('Target.getTargets');
    const worker = targetInfos.find(target => target.url?.startsWith(`chrome-extension://${EXTENSION_ID}/`));
    if (!worker) return null;
    let sessionId;
    try {
      ({ sessionId } = await browser.browserDevTools.connection.send('Target.attachToTarget', {
        targetId: worker.targetId,
        flatten: true,
      }));
      await browser.browserDevTools.connection.send('Runtime.enable', {}, sessionId);
      const result = await browser.browserDevTools.connection.send('Runtime.evaluate', {
        expression: `JSON.stringify({brave:Boolean(navigator.brave),edge:navigator.userAgent.includes("Edg/"),testAppState:typeof currentRules!=="undefined"&&currentRules.some(rule=>rule.host===${JSON.stringify(testMarkerHost)})})`,
        returnByValue: true,
      }, sessionId);
      return typeof result.result.value === 'string' ? JSON.parse(result.result.value) : null;
    } catch {
      return null;
    } finally {
      if (sessionId) await browser.browserDevTools.connection.send('Target.detachFromTarget', { sessionId }).catch(() => {});
    }
  }, 15_000, 100);
}

async function readState(statePath) {
  try { return JSON.parse(await fs.promises.readFile(statePath, 'utf8')); }
  catch { return null; }
}

async function waitForHealth(statePath, family, status, browser = null) {
  try {
    const result = await waitFor(`${family} integration ${status}`, async () => {
      const state = await readState(statePath);
      if (state?.browserHealth?.[family]?.status === status) return state;
      if (browser && (browser.process.exitCode !== null || browser.process.signalCode !== null)) {
        return { browserExited: true, state };
      }
      return null;
    }, status === 'healthy' ? 45_000 : 40_000);
    if (result.browserExited) throw new Error(`${family} disposable browser exited before reporting ${status}`);
    return result;
  } catch (error) {
    const state = await readState(statePath);
    let extensionWorker = false;
    if (browser?.browserDevTools) {
      const targets = await browser.browserDevTools.connection.send('Target.getTargets').catch(() => ({ targetInfos: [] }));
      extensionWorker = targets.targetInfos.some(target => target.url?.startsWith(`chrome-extension://${EXTENSION_ID}/`));
    }
    let extensionPreference = false;
    let extensionPath = false;
    try {
      const preferences = JSON.parse(await fs.promises.readFile(path.join(browser.profilePath, 'Default', 'Preferences'), 'utf8'));
      const extension = preferences.extensions?.settings?.[EXTENSION_ID];
      extensionPreference = Boolean(extension);
      extensionPath = Boolean(extension?.path);
    } catch {}
    const processRows = powershellProcessRows();
    const browserCommandLine = processRows.find(row => Number(row.ProcessId) === browser.process.pid)?.CommandLine ?? '';
    const loadFlagPresent = browserCommandLine.includes('--load-extension=');
    const processExited = browser ? browser.process.exitCode !== null || browser.process.signalCode !== null : false;
    const nativeTrace = browser?.nativeTracePath && fs.existsSync(browser.nativeTracePath)
      ? fs.readFileSync(browser.nativeTracePath, 'utf8').split(/\r?\n/).filter(line => line.includes('Locky native host:')).slice(-8).join(' | ')
      : '';
    throw new Error(`${error.message}; health=${JSON.stringify(state?.browserHealth ?? {})}; extensionWorker=${extensionWorker}; extensionPreference=${extensionPreference}; extensionPath=${extensionPath}; loadFlagPresent=${loadFlagPresent}; testBrowserExited=${processExited}; testAppState=${browser?.extensionIdentity?.testAppState ?? false}; nativeHostTrace=${nativeTrace || 'none'}`);
  }
}

function powershellProcessRows() {
  const script = 'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,CommandLine | ConvertTo-Json -Compress';
  const output = execFileSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
  }).trim();
  if (!output) return [];
  const parsed = JSON.parse(output);
  return Array.isArray(parsed) ? parsed : [parsed];
}

function browserLaunchEvidence(browser) {
  const processRows = powershellProcessRows();
  const commandLine = processRows.find(row => Number(row.ProcessId) === browser.process.pid)?.CommandLine ?? '';
  const processIds = processTreeIds(browser.process.pid, processRows);
  const nativeHostProcesses = processRows.filter(row => (
    processIds.has(Number(row.ProcessId))
  ) && /locky-native-host/i.test(String(row.Name))).length;
  return {
    pipeFlagPresent: commandLine.includes('--remote-debugging-pipe'),
    isolatedProfileFlagPresent: commandLine.includes('--user-data-dir='),
    nativeHostProcesses,
  };
}

function processTreeIds(rootPid, processRows) {
  const ids = new Set([Number(rootPid)]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of processRows) {
      if (!ids.has(Number(row.ParentProcessId))) continue;
      const pid = Number(row.ProcessId);
      if (!ids.has(pid)) {
        ids.add(pid);
        changed = true;
      }
    }
  }
  return ids;
}

function descendantsFor(rootPid, processRows, executableNames) {
  const ids = processTreeIds(rootPid, processRows);
  const names = new Set(executableNames.map(name => name.toLowerCase()));
  return processRows
    .filter(row => ids.has(Number(row.ProcessId)) && names.has(String(row.Name).toLowerCase()))
    .map(row => Number(row.ProcessId));
}

function browserPidsFor(browser, processRows) {
  const names = new Set(browser.spec.executableNames.map(name => name.toLowerCase()));
  const treeIds = processTreeIds(browser.process.pid, processRows);
  const profilePath = path.resolve(browser.profilePath).toLowerCase();
  return [...new Set(processRows
    .filter(row => names.has(String(row.Name).toLowerCase()) && (
      treeIds.has(Number(row.ProcessId))
      || String(row.CommandLine ?? '').toLowerCase().includes(profilePath)
    ))
    .map(row => Number(row.ProcessId))
    .filter(pid => Number.isSafeInteger(pid) && pid > 0))];
}

function createScopeWriter(scopePath, browsers) {
  return function refreshScope() {
    const processRows = powershellProcessRows();
    const scope = {};
    for (const browser of browsers) {
      const processIds = browserPidsFor(browser, processRows);
      if (processIds.length) scope[browser.spec.family] = processIds;
    }
    fs.writeFileSync(scopePath, JSON.stringify(scope));
    return scope;
  };
}

async function scopeBrowserBeforeExtension(browser, scopePath, browsers) {
  return waitFor(`${browser.spec.label} test PID scope`, () => {
    const scope = createScopeWriter(scopePath, browsers)();
    return scope[browser.spec.family]?.includes(browser.process.pid) ? scope : null;
  }, 15_000, 250);
}

function browserWindowsForFamily(windows, browser, scope) {
  const processIds = new Set(scope[browser.spec.family] ?? []);
  return windows.filter(window => processIds.has(window.processId) && window.className === 'Chrome_WidgetWin_1');
}

function overlayWindowsForFamily(windows, browser, scope) {
  const browserWindows = browserWindowsForFamily(windows, browser, scope);
  const browserWindowIds = new Set(browserWindows.map(window => window.id));
  return windows.filter(window => (
    window.processId === appProcessPid
    && window.title === 'Bloqueo activado'
    && browserWindowIds.has(window.ownerId)
  ));
}

function isBrowserWindowTitle(title) {
  const normalized = title.toLowerCase();
  return normalized.endsWith(' - google chrome')
    || normalized.endsWith(' - brave')
    || normalized.endsWith(' - microsoft edge');
}

function assertPreexistingBrowserWindowsUnchanged(baseline, scopePath) {
  const windows = snapshotWindows();
  for (const original of baseline) {
    assert(windows.some(window => window.id === original.id && window.processId === original.processId), 'A pre-existing browser window disappeared during the isolated smoke.');
  }
  const scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'));
  const scopedPids = new Set(Object.values(scope).flat());
  for (const original of baseline) {
    assert(!scopedPids.has(original.processId), 'A pre-existing browser PID entered the isolated test process scope.');
  }
  const originalIds = new Set(baseline.map(window => window.id));
  const unexpectedOverlays = windows.filter(window => (
    window.processId === appProcessPid
    && window.title === 'Bloqueo activado'
    && originalIds.has(window.ownerId)
  ));
  assert(unexpectedOverlays.length === 0, 'A Locky test overlay attached to a pre-existing browser window.');
}

let appProcessPid = 0;

async function waitForOverlay(browser, scopePath, visible = true, browserWindowCount = null, expectMinimized = null) {
  let last = {};
  try {
    return await waitFor(`${visible ? 'visible' : 'hidden'} Locky overlay for ${browser.spec.label}`, async () => {
      const scope = JSON.parse(await fs.promises.readFile(scopePath, 'utf8'));
      const windows = snapshotWindows();
      const browserWindows = browserWindowsForFamily(windows, browser, scope);
      const overlays = overlayWindowsForFamily(windows, browser, scope);
      last = {
        browserWindows: browserWindows.length,
        visibleBrowserWindows: browserWindows.filter(window => window.visible && !window.minimized).length,
        minimizedBrowserWindows: browserWindows.filter(window => window.minimized).length,
        overlays: overlays.length,
        visibleOverlays: overlays.filter(window => window.visible).length,
        scopedPids: scope[browser.spec.family]?.length ?? 0,
      };
      if (browserWindowCount !== null && browserWindows.length !== browserWindowCount) return null;
      if (expectMinimized !== null && browserWindows.some(window => window.minimized !== expectMinimized)) return null;
      const expectedVisible = browserWindows.filter(window => window.visible && !window.minimized).length;
      if (visible ? overlays.filter(window => window.visible).length !== expectedVisible : overlays.some(window => window.visible)) return null;
      return { browserWindows, overlays };
    }, 20_000, 250);
  } catch (error) {
    throw new Error(`${error.message}; observed=${JSON.stringify(last)}`);
  }
}

function startBrowser(spec, executable, profilePath, fixturePort, testEnv, includeExtension = true) {
  fs.mkdirSync(profilePath, { recursive: true });
  const args = [
    `--user-data-dir=${profilePath}`,
    '--remote-debugging-pipe',
    '--enable-unsafe-extension-debugging',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-background-mode',
    '--disable-default-apps',
    '--disable-sync',
    '--window-size=1040,760',
    `--host-resolver-rules=MAP ${blockedHost} 127.0.0.1`,
    'about:blank',
  ];
  const nativeTracePath = path.join(profilePath, 'browser-stderr.log');
  const stderrHandle = fs.openSync(nativeTracePath, 'w');
  const child = spawn(executable, args, {
    cwd: projectRoot,
    env: testEnv,
    stdio: ['ignore', 'ignore', stderrHandle, 'pipe', 'pipe'],
    windowsHide: false,
  });
  fs.closeSync(stderrHandle);
  child.once('error', error => { child.startError = error; });
  return { spec, executable, profilePath, nativeTracePath, fixturePort, includeExtension, process: child, browserDevTools: null };
}

async function browserClose(browser) {
  if (!browser.browserDevTools) return;
  try { await browser.browserDevTools.connection.send('Browser.close'); }
  catch {}
  browser.browserDevTools.connection.close();
  await waitFor(`${browser.spec.label} test process exit`, () => browser.process.exitCode !== null || browser.process.signalCode !== null, 15_000)
    .catch(() => {
      // This fallback is constrained to the root PID created by this harness.
      try { execFileSync('taskkill.exe', ['/PID', String(browser.process.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); }
      catch {}
    });
  browser.browserDevTools = null;
}

async function launchBrowser(browser, testEnv) {
  assert(!browser.process.startError, `${browser.spec.label} could not start.`);
  browser.browserDevTools = { connection: cdpPipeConnect(browser.process) };
  if (browser.includeExtension) {
    const extension = await browser.browserDevTools.connection.send('Extensions.loadUnpacked', { path: EXTENSION_PATH });
    nodeAssert.equal(extension.id, EXTENSION_ID, `${browser.spec.label} loaded an unexpected extension ID.`);
    await waitFor(`${browser.spec.label} extension worker`, async () => {
      const targets = await browser.browserDevTools.connection.send('Target.getTargets');
      return targets.targetInfos.some(target => target.url?.startsWith(`chrome-extension://${EXTENSION_ID}/`));
    }, 15_000);
    browser.extensionIdentity = await extensionWorkerIdentity(browser);
  }
  return browser;
}

async function navigate(browser, url) {
  const { page, target } = await connectPage(browser);
  try {
    await page.send('Page.navigate', { url });
    await delay(1000);
    return { page, target };
  } catch (error) {
    page.close();
    throw error;
  }
}

async function browserWindowBounds(browser) {
  const { targetInfos } = await browser.browserDevTools.connection.send('Target.getTargets');
  const pageTargets = targetInfos.filter(target => target.type === 'page' && !target.url?.startsWith('chrome-extension://'));
  const windows = new Map();
  for (const target of pageTargets) {
    const bounds = await browser.browserDevTools.connection.send('Browser.getWindowForTarget', { targetId: target.targetId });
    windows.set(bounds.windowId, bounds.bounds);
  }
  return windows;
}

async function setMinimized(browser, minimized) {
  for (const [windowId, bounds] of await browserWindowBounds(browser)) {
    const nextBounds = minimized
      ? { windowState: 'minimized' }
      : { windowState: 'normal', left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height };
    await browser.browserDevTools.connection.send('Browser.setWindowBounds', { windowId, bounds: nextBounds });
  }
}

async function openAdditionalWindow(browser) {
  const result = await browser.browserDevTools.connection.send('Target.createTarget', { url: 'about:blank', newWindow: true });
  assert(result.targetId, `Could not open an additional ${browser.spec.label} window.`);
}

async function waitForAllowedRoute(browser, fixturePort, fixtureLog) {
  const route = `/allowed/${browser.spec.family}`;
  const before = fixtureLog.filter(entry => entry.url === route).length;
  const { page } = await navigate(browser, `http://127.0.0.1:${fixturePort}${route}`);
  try {
    await waitFor(`${browser.spec.label} allowed page response`, () => fixtureLog.filter(entry => entry.url === route).length > before, 10_000);
  } finally {
    page.close();
  }
}

async function inspectRepairUi(appDevTools, family) {
  const targets = await listAppTargets(appDevTools.port);
  const settingsTarget = targets.find(target => target.type === 'page' && target.title === 'Locky Desktop');
  assert(settingsTarget, 'The isolated Locky settings window is not available for repair verification.');
  const page = await cdpConnect(settingsTarget.webSocketDebuggerUrl);
  try {
    await page.send('Runtime.enable');
    const result = await page.send('Runtime.evaluate', {
      expression: `JSON.stringify({status:document.querySelector('#status')?.textContent,health:document.querySelector('#browser-health')?.innerText})`,
      returnByValue: true,
    });
    const ui = JSON.parse(result.result.value);
    assert(ui.status.includes('Reparación necesaria'), 'Locky did not show a repair status in settings.');
    assert(ui.health.includes(family === 'chrome' ? 'Chrome' : family), 'The repair status is not attached to the missing browser.');
    assert(ui.health.includes('Reparación necesaria'), 'The browser row does not explain how to repair the missing extension.');
  } finally {
    page.close();
  }
}

async function run() {
  assert(process.platform === 'win32', 'The installed browser lifecycle smoke requires Windows.');
  const electronBinary = findElectronBinary();
  const executableByFamily = Object.fromEntries(BROWSER_SPECS.map(spec => [spec.family, findExecutable(spec)]));
  verifyNativeHostRegistration();
  const preexistingBrowserWindows = snapshotWindows().filter(window => (
    window.className === 'Chrome_WidgetWin_1' && isBrowserWindowTitle(window.title)
  ));
  log(`pre-existing browser windows captured outside test scope: ${preexistingBrowserWindows.length}`);

  const runDirectory = await fs.promises.mkdtemp(path.join(os.tmpdir(), `locky-browser-e2e-${process.pid}-`));
  const userDataPath = path.join(runDirectory, 'locky-data');
  const scopePath = path.join(runDirectory, 'browser-scope.json');
  await fs.promises.mkdir(userDataPath, { recursive: true });
  await fs.promises.writeFile(scopePath, '{}');
  testMarkerHost = `locky-e2e-${process.pid}-${Date.now().toString(36)}.invalid`;
  await fs.promises.writeFile(path.join(userDataPath, 'locky-state.json'), JSON.stringify({
    version: 1,
    revision: 0,
    rulesRevision: 0,
    rules: [{ id: 'e2e-sentinel', type: 'domain', host: testMarkerHost, path: '/', source: 'user' }],
  }));

  const testPipeName = `locky-e2e-${process.pid}-${Date.now().toString(36)}`;
  const appPort = await reservePort();
  const fixtureRequests = [];
  const fixtureServer = http.createServer((request, response) => {
    fixtureRequests.push({ method: request.method, url: new URL(request.url, 'http://127.0.0.1').pathname });
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end('<!doctype html><title>Locky E2E fixture</title><main>Fixture available</main>');
  });
  await new Promise((resolve, reject) => {
    fixtureServer.once('error', reject);
    fixtureServer.listen(0, '127.0.0.1', resolve);
  });
  const fixturePort = fixtureServer.address().port;
  const testEnv = {
    ...process.env,
    LOCKY_TEST_MODE: '1',
    LOCKY_TEST_PIPE_NAME: testPipeName,
    LOCKY_TEST_USER_DATA_DIR: userDataPath,
    LOCKY_TEST_BROWSER_SCOPE_FILE: scopePath,
    LOCKY_ENFORCE_UNHEALTHY_BROWSER: '1',
    LOCKY_NATIVE_HOST_TRACE: '1',
  };
  delete testEnv.LOCKY_TEST_NO_OVERLAY;
  delete testEnv.LOCKY_TEST_HIDE_SETTINGS;

  let appProcess;
  let appDevTools;
  const secondInstance = { child: null };
  let appProcessTreeStopper;
  const browsers = [];
  let expiryTimer;
  try {
    appProcess = spawn(electronBinary, [projectRoot, `--remote-debugging-port=${appPort}`], {
      cwd: projectRoot,
      env: testEnv,
      stdio: 'ignore',
      windowsHide: false,
    });
    appProcessPid = appProcess.pid;
    appProcess.once('error', error => { appProcess.startError = error; });
    appDevTools = await waitForDevTools(appPort);
    const statePath = path.join(userDataPath, 'locky-state.json');
    await waitFor('isolated state with consolidated rules', async () => {
      const state = await readState(statePath);
      return state && state.rules.length > 0 ? state : null;
    }, 45_000);
    log('isolated Locky instance is running with real overlays enabled');

    const initialProfiles = path.join(runDirectory, 'profiles');
    for (const [index, spec] of BROWSER_SPECS.entries()) {
      const browser = startBrowser(
        spec,
        executableByFamily[spec.family],
        path.join(initialProfiles, spec.family),
        fixturePort,
        testEnv,
      );
      browsers.push(browser);
      await scopeBrowserBeforeExtension(browser, scopePath, browsers);
      await launchBrowser(browser, testEnv);
      const launchEvidence = browserLaunchEvidence(browser);
      log(`${spec.label} launch: remote-debugging-pipe=${launchEvidence.pipeFlagPresent}; isolated profile=${launchEvidence.isolatedProfileFlagPresent}; extension loaded through DevTools; native host processes=${launchEvidence.nativeHostProcesses}`);
      if (browser.extensionIdentity) {
        log(`${spec.label} extension worker reports Brave=${browser.extensionIdentity.brave}; Edge=${browser.extensionIdentity.edge}`);
      }
      await waitForHealth(statePath, spec.family, 'healthy', browser);
      log(`${spec.label} extension connected in a disposable profile (${index + 1}/${BROWSER_SPECS.length})`);
    }

    const routeBefore = fixtureRequests.filter(request => request.url.startsWith('/blocked-probe')).length;
    let lockEndAt = null;
    for (const browser of browsers) {
      const url = `http://${blockedHost}:${fixturePort}/blocked-probe/${browser.spec.family}`;
      const { page } = await navigate(browser, url);
      page.close();
      const state = await waitFor('a shared browser lock after a blocked route', async () => {
        const latest = await readState(statePath);
        return latest?.desktopLock?.endsAt ? latest : null;
      }, 20_000);
      lockEndAt ??= state.desktopLock.endsAt;
      nodeAssert.equal(state.desktopLock.endsAt, lockEndAt, 'A repeated blocked route reset the active seven-minute expiry.');
      log(`${browser.spec.label} prohibited route remained blocked`);
    }
    nodeAssert.equal(fixtureRequests.filter(request => request.url.startsWith('/blocked-probe')).length, routeBefore, 'A prohibited route reached the fixture server.');

    let scope = createScopeWriter(scopePath, browsers)();
    for (const browser of browsers) {
      const attached = await waitForOverlay(browser, scopePath, true);
      nodeAssert.equal(
        attached.overlays.filter(window => window.visible).length,
        attached.browserWindows.filter(window => window.visible && !window.minimized).length,
        `${browser.spec.label} did not have a visible Locky overlay for every visible window.`,
      );
      log(`${browser.spec.label} has a visible Locky lock window`);
    }
    assertPreexistingBrowserWindowsUnchanged(preexistingBrowserWindows, scopePath);
    log('pre-existing browser windows remained outside the test scope');
    const scopeForCountdown = JSON.parse(await fs.promises.readFile(scopePath, 'utf8'));
    const browserSnapshot = snapshotWindows();
    const visibleWindowCount = browsers.reduce((count, browser) => count + browserWindowsForFamily(browserSnapshot, browser, scopeForCountdown)
      .filter(window => window.visible && !window.minimized).length, 0);
    const countdownBefore = await waitFor('a rendered countdown for every locked browser window', async () => {
      const values = await readOverlayCountdowns(appDevTools, visibleWindowCount);
      return values?.length === visibleWindowCount ? values : null;
    }, 20_000);
    const countdownAfter = await waitFor('the visible lock countdown to advance', async () => {
      const values = await readOverlayCountdowns(appDevTools, visibleWindowCount);
      if (!values) return null;
      const beforeById = new Map(countdownBefore.map(value => [value.id, value.seconds]));
      return values.every(value => value.seconds < beforeById.get(value.id)) ? values : null;
    }, 5_000, 250);
    nodeAssert.equal(countdownAfter.length, visibleWindowCount);
    log('every visible Locky page showed a countdown that advanced');

    await closeSettingsWindow(appDevTools);
    nodeAssert.equal(appProcess.exitCode, null, 'Closing the settings window exited the Locky process.');
    nodeAssert.equal(appProcess.signalCode, null, 'Closing the settings window signaled the Locky process.');
    nodeAssert.equal((await readState(statePath)).desktopLock.endsAt, lockEndAt, 'Closing settings cleared or reset the active lock.');
    for (const browser of browsers) await waitForOverlay(browser, scopePath, true);
    log('closing settings left Locky running with the shared browser lock active');

    await openSettingsWithSecondInstance(electronBinary, testEnv, appDevTools, secondInstance);
    nodeAssert.equal(appProcess.exitCode, null, 'Opening settings created a new Locky owner process.');
    nodeAssert.equal((await readState(statePath)).desktopLock.endsAt, lockEndAt, 'Reopening settings changed the active lock expiry.');
    log('a second launch reopened settings for the existing Locky instance without interrupting protection');

    for (const browser of browsers) {
      const initialBrowserWindowCount = (await waitForOverlay(browser, scopePath, true)).browserWindows.length;
      await setMinimized(browser, true);
      await waitForOverlay(browser, scopePath, false, initialBrowserWindowCount, true);
      await setMinimized(browser, false);
      await waitForOverlay(browser, scopePath, true, initialBrowserWindowCount, false);
      log(`${browser.spec.label} overlay followed minimize and restore`);

      await openAdditionalWindow(browser);
      await delay(1200);
      scope = createScopeWriter(scopePath, browsers)();
      await waitForOverlay(browser, scopePath, true, initialBrowserWindowCount + 1);
      log(`${browser.spec.label} additional window was covered`);

      const previousExpiry = (await readState(statePath)).desktopLock.endsAt;
      await browserClose(browser);
      createScopeWriter(scopePath, browsers)();
      await waitForOverlay(browser, scopePath, false, 0);
      log(`${browser.spec.label} lock window disappeared when its browser closed`);

      const reopened = startBrowser(
        browser.spec,
        browser.executable,
        browser.profilePath,
        fixturePort,
        testEnv,
      );
      browsers[browsers.indexOf(browser)] = reopened;
      await scopeBrowserBeforeExtension(reopened, scopePath, browsers);
      await launchBrowser(reopened, testEnv);
      await waitForHealth(statePath, reopened.spec.family, 'healthy', reopened);
      const reopenedOverlays = await waitForOverlay(reopened, scopePath, true);
      assert(reopenedOverlays.browserWindows.length > 0, `${reopened.spec.label} did not reopen a browser window.`);
      const reopenedState = await readState(statePath);
      nodeAssert.equal(reopenedState.desktopLock.endsAt, previousExpiry, `${browser.spec.label} reopen changed the shared expiry.`);
      log(`${browser.spec.label} lock window returned after reopen with remaining time`);
    }

    const remainingAtWaitStart = Math.max(0, lockEndAt - Date.now());
    log(`waiting for the shared seven-minute expiry (${Math.ceil(remainingAtWaitStart / 60_000)} min)`);
    let lastMinute = Math.ceil(remainingAtWaitStart / 60_000);
    expiryTimer = setInterval(() => {
      const minutes = Math.ceil(Math.max(0, lockEndAt - Date.now()) / 60_000);
      if (minutes !== lastMinute) {
        lastMinute = minutes;
        log(`expiry countdown: ${minutes} min remaining`);
      }
    }, 15_000);
    await waitFor('the seven-minute browser lock to expire', async () => {
      const state = await readState(statePath);
      return state && !state.desktopLock ? state : null;
    }, remainingAtWaitStart + 30_000, 500);
    clearInterval(expiryTimer);
    expiryTimer = null;
    scope = createScopeWriter(scopePath, browsers)();
    for (const browser of browsers) await waitForOverlay(browser, scopePath, false, null);
    log('the lock expired and all three lock windows disappeared');

    for (const browser of browsers) {
      await waitForAllowedRoute(browser, fixturePort, fixtureRequests);
      log(`${browser.spec.label} loaded an allowed page after expiry`);
    }

    const chrome = browsers.find(browser => browser.spec.family === 'chrome');
    const healthyOthers = browsers.filter(browser => browser !== chrome);
    await browserClose(chrome);
    createScopeWriter(scopePath, browsers)();
    await waitFor(statePath + ' Chrome idle state', async () => {
      const state = await readState(statePath);
      return state?.browserHealth?.chrome?.status === 'idle' ? state : null;
    }, 10_000);

    const missingProfile = path.join(runDirectory, 'profiles', 'chrome-without-extension');
    const missingBrowser = startBrowser(
      chrome.spec,
      chrome.executable,
      missingProfile,
      fixturePort,
      testEnv,
      false,
    );
    browsers[browsers.indexOf(chrome)] = missingBrowser;
    await scopeBrowserBeforeExtension(missingBrowser, scopePath, browsers);
    await launchBrowser(missingBrowser, testEnv);
    const repairState = await waitFor(statePath + ' missing extension repair', async () => {
      const state = await readState(statePath);
      return state?.browserHealth?.chrome?.status === 'repair' && state.browserHealth.chrome.reason === 'missing' ? state : null;
    }, 45_000);
    await waitFor('the extensionless Chrome test process to close', () => missingBrowser.process.exitCode !== null || missingBrowser.process.signalCode !== null, 15_000);
    for (const browser of healthyOthers) {
      nodeAssert.equal(browser.process.exitCode, null, `${browser.spec.label} closed after Chrome integration failure.`);
      nodeAssert.equal(browser.process.signalCode, null, `${browser.spec.label} was signaled after Chrome integration failure.`);
    }
    await inspectRepairUi(appDevTools, 'chrome');
    nodeAssert.equal(repairState.browserHealth.chrome.reason, 'missing');
    assertPreexistingBrowserWindowsUnchanged(preexistingBrowserWindows, scopePath);
    log('missing-extension repair closed only the scoped Chrome test profile; Brave and Edge remained open');
    log('pre-existing browser windows and PIDs remained outside test scope after repair');
    log('settings showed a browser-specific repair instruction');
    log('PASS: installed-browser lifecycle smoke completed');
  } finally {
    if (expiryTimer) clearInterval(expiryTimer);
    fs.writeFileSync(scopePath, '{}');
    await Promise.allSettled(browsers.map(browserClose));
    if (secondInstance.child?.pid && secondInstance.child.exitCode === null && secondInstance.child.signalCode === null) {
      try { execFileSync('taskkill.exe', ['/PID', String(secondInstance.child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); }
      catch {}
    }
    if (appDevTools) appDevTools.connection.close();
    if (appProcess?.pid && appProcess.exitCode === null && appProcess.signalCode === null) {
      try { execFileSync('taskkill.exe', ['/PID', String(appProcess.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); }
      catch {}
      await waitFor('the isolated Locky process exit', () => appProcess.exitCode !== null || appProcess.signalCode !== null, 10_000).catch(() => {});
    }
    await new Promise(resolve => fixtureServer.close(() => resolve()));
    await fs.promises.rm(runDirectory, { recursive: true, force: true });
  }
}

run().catch(error => {
  process.stderr.write(`[browser-lifecycle] FAIL: ${error.message}\n`);
  process.exitCode = 1;
});
