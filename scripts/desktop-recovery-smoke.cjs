const { spawn, execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

const projectRoot = path.resolve(__dirname, '..');
const launcherSource = path.join(projectRoot, 'install', 'windows', 'native-host-launcher.cs');

function log(message) {
  process.stdout.write(`[desktop-recovery] ${message}\n`);
}

function findElectronBinary() {
  const configured = process.env.LOCKY_E2E_ELECTRON;
  if (configured && fsSync.existsSync(configured)) return configured;
  try {
    const resolved = require('electron');
    if (typeof resolved === 'string' && fsSync.existsSync(resolved)) return resolved;
  } catch {}
  const local = path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
  assert(fsSync.existsSync(local), 'Install dependencies with pnpm before running the recovery smoke.');
  return local;
}

function findCSharpCompiler() {
  const windowsDirectory = process.env.WINDIR ?? 'C:\\Windows';
  const candidates = [
    path.join(windowsDirectory, 'Microsoft', 'NET', 'Framework64', 'v4.0.30319', 'csc.exe'),
    path.join(windowsDirectory, 'Microsoft', 'NET', 'Framework', 'v4.0.30319', 'csc.exe'),
  ];
  return candidates.find(candidate => fsSync.existsSync(candidate)) ?? null;
}

function compileTestLauncher(runDirectory, outputPath) {
  const csharpCompiler = findCSharpCompiler();
  if (csharpCompiler) {
    execFileSync(csharpCompiler, ['/nologo', '/target:exe', `/out:${outputPath}`, launcherSource], {
      windowsHide: true,
      stdio: 'pipe',
    });
  } else {
    execFileSync('dotnet', ['--version'], { windowsHide: true, stdio: 'ignore' });
    const projectFile = path.join(runDirectory, 'native-host-test.csproj');
    const escapedSource = launcherSource.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    fsSync.writeFileSync(projectFile, [
      '<Project Sdk="Microsoft.NET.Sdk">',
      '  <PropertyGroup>',
      '    <OutputType>Exe</OutputType>',
      '    <TargetFramework>net8.0</TargetFramework>',
      '    <ImplicitUsings>disable</ImplicitUsings>',
      '    <Nullable>disable</Nullable>',
      '    <AssemblyName>locky-native-host-test</AssemblyName>',
      '    <EnableDefaultCompileItems>false</EnableDefaultCompileItems>',
      '    <UseAppHost>true</UseAppHost>',
      '  </PropertyGroup>',
      '  <ItemGroup>',
      `    <Compile Include="${escapedSource}" Link="Program.cs" />`,
      '  </ItemGroup>',
      '</Project>',
    ].join('\n'));
    const env = {
      ...process.env,
      DOTNET_CLI_HOME: path.join(runDirectory, 'dotnet-home'),
      DOTNET_SKIP_FIRST_TIME_EXPERIENCE: '1',
      DOTNET_CLI_TELEMETRY_OPTOUT: '1',
      NUGET_PACKAGES: path.join(runDirectory, 'nuget-packages'),
    };
    try {
      execFileSync('dotnet', [
        'build',
        projectFile,
        '--configuration', 'Release',
        '--output', path.dirname(outputPath),
        '--nologo',
        '-p:RestoreIgnoreFailedSources=true',
      ], { cwd: runDirectory, env, windowsHide: true, stdio: 'pipe' });
    } catch (error) {
      throw new Error(error.stderr?.toString('utf8') || error.message);
    }
  }
  assert(fsSync.existsSync(outputPath), 'The isolated native-host launcher did not compile.');
}

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(error => error ? reject(error) : resolve(port));
    });
  });
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
  throw new Error(`Timed out waiting for ${description}${lastError ? `: ${lastError.message}` : ''}`);
}

async function readState(filePath) {
  try { return JSON.parse(await fs.readFile(filePath, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function waitForDevTools(port) {
  return waitFor(`isolated Locky DevTools port ${port}`, async () => {
    try { return await fetchJson(`http://127.0.0.1:${port}/json/version`); }
    catch { return null; }
  });
}

function createTestEnvironment(electronBinary, userDataPath, scopePath, pipeToken, launchMarker) {
  const env = {
    ...process.env,
    LOCKY_TEST_MODE: '1',
    LOCKY_TEST_PIPE_NAME: pipeToken,
    LOCKY_TEST_USER_DATA_DIR: userDataPath,
    LOCKY_TEST_BROWSER_SCOPE_FILE: scopePath,
    LOCKY_TEST_APP_EXECUTABLE: electronBinary,
    LOCKY_TEST_APP_ROOT: projectRoot,
    LOCKY_TEST_LAUNCH_MARKER: launchMarker,
  };
  delete env.LOCKY_TEST_NO_OVERLAY;
  delete env.LOCKY_TEST_HIDE_SETTINGS;
  return env;
}

function startInitialApp(electronBinary, env, port) {
  const child = spawn(electronBinary, [projectRoot, `--remote-debugging-port=${port}`, `--locky-test-launch=${env.LOCKY_TEST_LAUNCH_MARKER}`], {
    cwd: projectRoot,
    env,
    stdio: 'ignore',
    windowsHide: false,
  });
  child.once('error', error => { child.startError = error; });
  return child;
}

function startNativeHost(hostExecutable, env) {
  const child = spawn(hostExecutable, [], {
    cwd: projectRoot,
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
  child.once('error', error => { child.startError = error; });
  let output = Buffer.alloc(0);
  const pending = [];
  child.stdout.on('data', chunk => {
    output = Buffer.concat([output, chunk]);
    while (output.length >= 4) {
      const messageLength = output.readUInt32LE(0);
      if (messageLength > 1024 * 1024) {
        pending.shift()?.reject(new Error('Native host returned an oversized response.'));
        output = Buffer.alloc(0);
        return;
      }
      if (output.length < messageLength + 4) return;
      const messageBytes = output.subarray(4, messageLength + 4);
      output = output.subarray(messageLength + 4);
      const waiter = pending.shift();
      if (!waiter) continue;
      try { waiter.resolve(JSON.parse(messageBytes.toString('utf8'))); }
      catch (error) { waiter.reject(error); }
    }
  });
  child.once('exit', (code, signal) => {
    for (const waiter of pending.splice(0)) waiter.reject(new Error(`Native host exited (${code ?? signal}) before replying.`));
  });
  child.once('error', error => {
    for (const waiter of pending.splice(0)) waiter.reject(error);
  });
  return {
    child,
    request(message) {
      if (child.startError) return Promise.reject(child.startError);
      const payload = Buffer.from(JSON.stringify(message), 'utf8');
      const header = Buffer.alloc(4);
      header.writeUInt32LE(payload.length);
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          const index = pending.indexOf(waiter);
          if (index >= 0) pending.splice(index, 1);
          reject(new Error('Native host request timed out.'));
        }, 15_000);
        const waiter = {
          resolve(value) { clearTimeout(timeout); resolve(value); },
          reject(error) { clearTimeout(timeout); reject(error); },
        };
        pending.push(waiter);
        child.stdin.write(Buffer.concat([header, payload]), error => {
          if (!error) return;
          const index = pending.indexOf(waiter);
          if (index >= 0) pending.splice(index, 1);
          clearTimeout(timeout);
          reject(error);
        });
      });
    },
  };
}

function processRows() {
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

function findRestartedAppPid(launchMarker) {
  const commandMarker = `--locky-test-launch=${launchMarker}`.toLowerCase();
  const appRoot = projectRoot.toLowerCase();
  const candidates = processRows().filter(row => String(row.Name).toLowerCase() === 'electron.exe'
    && String(row.CommandLine ?? '').toLowerCase().includes(commandMarker)
    && String(row.CommandLine ?? '').toLowerCase().includes(appRoot)
    && String(row.CommandLine ?? '').toLowerCase().includes('--background'));
  const candidatePids = new Set(candidates.map(row => Number(row.ProcessId)));
  const root = candidates.find(row => !candidatePids.has(Number(row.ParentProcessId)));
  return root ? Number(root.ProcessId) : null;
}

function processTreePids(rootPid, rows) {
  const ids = new Set([Number(rootPid)]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of rows) {
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

async function waitForProcessExit(child, description, timeoutMs = 15_000) {
  await waitFor(description, () => child.exitCode !== null || child.signalCode !== null, timeoutMs);
}

async function stopTestProcess(pid, child = null) {
  if (!pid) return;
  if (child && (child.exitCode !== null || child.signalCode !== null)) return;
  const trackedPids = processTreePids(pid, processRows());
  try { execFileSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); }
  catch {}
  if (child) await waitForProcessExit(child, 'the isolated Locky process tree to exit', 10_000).catch(() => {});
  await waitFor('the isolated process tree to release its temporary data', () => {
    const runningPids = new Set(processRows().map(row => Number(row.ProcessId)));
    return [...trackedPids].every(trackedPid => !runningPids.has(trackedPid));
  }, 10_000, 200).catch(() => {});
}

async function stopNativeHost(host) {
  if (!host || host.child.exitCode !== null || host.child.signalCode !== null) return;
  host.child.stdin.end();
  try { await waitForProcessExit(host.child, 'the temporary native host to exit', 5000); }
  catch { await stopTestProcess(host.child.pid, host.child); }
}

async function run() {
  assert(process.platform === 'win32', 'The isolated Locky recovery smoke requires Windows.');
  const electronBinary = findElectronBinary();
  const runDirectory = await fs.mkdtemp(path.join(os.tmpdir(), `locky-desktop-recovery-${process.pid}-`));
  const userDataPath = path.join(runDirectory, 'locky-data');
  const scopePath = path.join(runDirectory, 'browser-scope.json');
  const statePath = path.join(userDataPath, 'locky-state.json');
  const token = `locky-recovery-${process.pid}-${Date.now().toString(36)}`;
  const markerHost = `recovery-${process.pid}-${Date.now().toString(36)}.invalid`;
  let expiresAt;
  const testEnv = createTestEnvironment(electronBinary, userDataPath, scopePath, token, token);
  const launcherPath = path.join(runDirectory, 'locky-native-host-test.exe');
  await fs.mkdir(userDataPath, { recursive: true });
  await fs.writeFile(scopePath, '{}');
  compileTestLauncher(runDirectory, launcherPath);
  expiresAt = Date.now() + 150_000;
  await fs.writeFile(statePath, JSON.stringify({
    version: 1,
    revision: 0,
    rulesRevision: 0,
    rules: [{ id: 'restart-sentinel', type: 'domain', host: markerHost, path: '/', source: 'user' }],
    pendingRules: [],
    desktopLock: { startedAt: expiresAt - 90_000, endsAt: expiresAt },
    candidateListApproved: false,
    candidateListApprovedAt: null,
    candidateList: [],
    candidateListCheckedAt: null,
    browserHealth: {},
  }));
  log('compiled a temporary native-host launcher; no registry values were read or written');

  let appProcess;
  const hosts = [];
  let restartedAppPid = null;
  try {
    const firstPort = await reservePort();
    appProcess = startInitialApp(electronBinary, testEnv, firstPort);
    await waitForDevTools(firstPort);
    const initial = await waitFor('the persisted active lock and permanent rule', async () => {
      const state = await readState(statePath);
      return state?.desktopLock?.endsAt === expiresAt && state.rules.some(rule => rule.id === 'restart-sentinel') ? state : null;
    });
    assert.equal(initial.desktopLock.endsAt, expiresAt);
    log('isolated Locky restored the temporary active lock and rules');

    const firstHost = startNativeHost(launcherPath, testEnv);
    hosts.push(firstHost);
    const initialPipeState = await firstHost.request({ id: 'initial-state', type: 'getState', offset: 0, limit: 500 });
    assert.equal(initialPipeState.ok, true);
    assert(initialPipeState.rules.some(rule => rule.id === 'restart-sentinel'));
    log('temporary native host served the isolated rules through the native-messaging pipe');

    const crashedPid = appProcess.pid;
    await stopTestProcess(crashedPid, appProcess);
    appProcess = null;
    const afterCrash = await readState(statePath);
    assert.equal(afterCrash.desktopLock.endsAt, expiresAt, 'The isolated process failure changed the saved expiry.');
    log('only the temporary Locky process tree was stopped; saved rules and expiry remained readable');
    await waitForProcessExit(firstHost.child, 'the temporary host monitor to exit after its pipe closed', 10_000);
    log('the first temporary native host exited after it detected the missing app pipe');

    const reconnectHost = startNativeHost(launcherPath, testEnv);
    hosts.push(reconnectHost);
    const restoredPipeState = await reconnectHost.request({ id: 'reconnected-state', type: 'getState', offset: 0, limit: 500 });
    assert.equal(restoredPipeState.ok, true);
    assert(restoredPipeState.rules.some(rule => rule.id === 'restart-sentinel'));
    restartedAppPid = await waitFor('the native host to relaunch the tagged temporary Locky process', () => findRestartedAppPid(token), 20_000);
    assert.notEqual(restartedAppPid, crashedPid);
    const restored = await waitFor('the relaunched process to restore the same active lock', async () => {
      const state = await readState(statePath);
      return state?.desktopLock?.endsAt === expiresAt && state.rules.some(rule => rule.id === 'restart-sentinel') ? state : null;
    });
    assert(expiresAt > Date.now(), 'The lock expired before the isolated automatic relaunch was verified.');
    assert.equal(restored.desktopLock.endsAt, expiresAt);
    log('a reconnecting temporary native host relaunched the tagged Electron process with its original lock and rule');

    const healthReply = await reconnectHost.request({ id: 'reconnected-health', type: 'health', browserFamily: 'chrome', ok: true });
    assert.equal(healthReply.ok, true);
    const syncedState = await reconnectHost.request({ id: 'reconnected-state-confirm', type: 'getState', offset: 0, limit: 500 });
    assert(syncedState.rules.some(rule => rule.id === 'restart-sentinel'));
    assert((await readState(statePath)).desktopLock.endsAt === expiresAt);
    log('the relaunched app accepted a browser health message and served its persisted rules');

    try {
      await waitFor('the persisted lock to expire at its original deadline', async () => {
        const state = await readState(statePath);
        return state && state.desktopLock === null ? state : null;
      }, Math.max(1000, expiresAt - Date.now() + 30_000), 250);
    } catch (error) {
      const latest = await readState(statePath);
      throw new Error(`${error.message}; savedExpiry=${expiresAt}; observedLock=${JSON.stringify(latest?.desktopLock)}`);
    }
    const expiredState = await readState(statePath);
    assert(expiredState.rules.some(rule => rule.id === 'restart-sentinel'), 'Lock expiry removed the permanent rule.');
    log('the lock expired at its saved deadline after automatic relaunch while the permanent rule remained');
    log('PASS: isolated native-host recovery smoke completed');
  } finally {
    await Promise.allSettled(hosts.map(stopNativeHost));
    if (appProcess && appProcess.exitCode === null && appProcess.signalCode === null) {
      await stopTestProcess(appProcess.pid, appProcess);
    } else {
      const remainingRestartedPid = findRestartedAppPid(token) ?? restartedAppPid;
      if (remainingRestartedPid) await stopTestProcess(remainingRestartedPid);
    }
    const resolvedRunDirectory = path.resolve(runDirectory);
    const temporaryRoot = `${path.resolve(os.tmpdir())}${path.sep}`;
    assert(resolvedRunDirectory.startsWith(temporaryRoot), 'Refusing to remove recovery smoke data outside the temporary directory.');
    let cleanupError;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        await fs.rm(resolvedRunDirectory, { recursive: true, force: true });
        cleanupError = null;
        break;
      } catch (error) {
        cleanupError = error;
        if (!['EBUSY', 'EPERM', 'ENOTEMPTY'].includes(error.code)) throw error;
        await delay(250 * (attempt + 1));
      }
    }
    if (cleanupError) throw cleanupError;
  }
}

run().catch(error => {
  process.stderr.write(`[desktop-recovery] FAIL: ${error.message}\n`);
  process.exitCode = 1;
});
