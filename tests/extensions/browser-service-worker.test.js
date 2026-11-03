import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function event() {
  const listeners = [];
  return {
    addListener(listener) { listeners.push(listener); },
    emit(value) { for (const listener of listeners) listener(value); },
  };
}

async function flushMicrotasks() {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

async function startExtension({
  browserFamily, rules, userAgent, brave = false, startupOnLoad = false,
  refreshAlarmExists = false, deferStateReplies = false, awaitSync = true, nativeUnavailable = false,
}) {
  const nativeMessages = [];
  const dynamicRules = [];
  const sessionRules = [];
  const alarmsCreated = [];
  const scheduledAlarms = new Map();
  if (refreshAlarmExists) {
    scheduledAlarms.set('locky-refresh', { name: 'locky-refresh', periodInMinutes: 0.5 });
  }
  const guardAtConnectionReports = [];
  const deferredStateRequests = [];
  const timers = [];
  let now = Date.now();
  let nativeAvailable = !nativeUnavailable;
  let nativeConnectCount = 0;
  let ready;
  const updated = new Promise(resolve => { ready = resolve; });
  function respondToStateRequest(message) {
    const reply = message.limit === 0
      ? { rules: [], totalRules: rules.length }
      : { rules, totalRules: rules.length };
    queueMicrotask(() => nativePort.onMessage.emit({
      id: message.id,
      ok: true,
      type: 'state',
      offset: message.offset,
      limit: message.limit,
      rulesRevision: 1,
      ...reply,
    }));
  }
  const nativePort = {
    onDisconnect: event(),
    onMessage: event(),
    disconnect() { this.onDisconnect.emit(); },
    postMessage(message) {
      nativeMessages.push(message);
      if (message.type === 'connected') {
        guardAtConnectionReports.push(sessionRules.some(rule => rule.id === 5001));
      }
      if (message.type !== 'getState') return;
      if (deferStateReplies) deferredStateRequests.push(message);
      else respondToStateRequest(message);
    },
  };
  const context = {
    URL,
    Map,
    Set,
    Date: class extends Date { static now() { return now; } },
    JSON,
    Promise,
    queueMicrotask,
    setTimeout(callback, delayMs) { timers.push({ callback, delayMs }); return timers.length; },
    navigator: { userAgent, ...(brave ? { brave: {} } : {}) },
  };
  const browserApi = {
      runtime: {
        connectNative() {
          nativeConnectCount += 1;
          if (!nativeAvailable) throw new Error('Locky is not running yet.');
          return nativePort;
        },
        onInstalled: event(),
        onStartup: event(),
      },
      alarms: {
        async get(name) { return scheduledAlarms.get(name); },
        create(name, alarmInfo) {
          alarmsCreated.push({ name, alarmInfo });
          scheduledAlarms.set(name, { name, ...alarmInfo });
        },
        onAlarm: event(),
      },
      declarativeNetRequest: {
        async getDynamicRules() { return dynamicRules; },
        async getSessionRules() { return sessionRules; },
        async updateDynamicRules({ removeRuleIds, addRules }) {
          for (const id of removeRuleIds) {
            const index = dynamicRules.findIndex(rule => rule.id === id);
            if (index >= 0) dynamicRules.splice(index, 1);
          }
          dynamicRules.push(...addRules);
          ready();
        },
        async updateSessionRules({ removeRuleIds = [], addRules = [] }) {
          for (const id of removeRuleIds) {
            const index = sessionRules.findIndex(rule => rule.id === id);
            if (index >= 0) sessionRules.splice(index, 1);
          }
          sessionRules.push(...addRules);
        },
      },
      webNavigation: { onBeforeNavigate: event(), onErrorOccurred: event() },
  };
  context[browserFamily === 'firefox' ? 'browser' : 'chrome'] = browserApi;
  const vmContext = vm.createContext(context);
  const extensionDirectory = path.join(projectRoot, 'extensions', browserFamily === 'firefox' ? 'firefox' : 'chromium');
  if (browserFamily === 'firefox') {
    const rulesSource = await readFile(path.join(extensionDirectory, 'rule-builder.js'), 'utf8');
    vm.runInContext(rulesSource, vmContext);
  } else {
    context.importScripts = file => {
      const source = readFileSync(path.join(extensionDirectory, file), 'utf8');
      vm.runInContext(source, vmContext);
    };
  }
  const source = await readFile(path.join(extensionDirectory, 'service-worker.js'), 'utf8');
  vm.runInContext(source, vmContext);
  if (startupOnLoad) browserApi.runtime.onStartup.emit();
  async function waitForStateSync() {
    await updated;
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  async function replyToNextStateRequest() {
    const request = deferredStateRequests.shift();
    assert.ok(request, 'a deferred getState request is waiting for a reply');
    respondToStateRequest(request);
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  if (awaitSync) await waitForStateSync();
  return {
    nativeMessages,
    dynamicRules,
    sessionRules,
    alarmsCreated,
    guardAtConnectionReports,
    webNavigation: browserApi.webNavigation,
    waitForSync: waitForStateSync,
    replyToNextStateRequest,
    disconnect() { nativePort.onDisconnect.emit(); },
    setNativeAvailable(value) { nativeAvailable = value; },
    getNativeConnectCount() { return nativeConnectCount; },
    runNextTimeout() {
      const timer = timers.shift();
      assert.ok(timer, 'a native reconnect retry is scheduled');
      timer.callback();
      return timer.delayMs;
    },
    fireRefreshAlarm() { browserApi.alarms.onAlarm.emit({ name: 'locky-refresh' }); },
    advanceTime(ms) { now += ms; },
  };
}

const blockedRule = [
    { id: 'rule-1', type: 'domain', host: 'blocked.example', path: '/' },
  ];

function assertBlockedNavigation(extension) {
  assert.equal(extension.sessionRules.length, 0, 'successful state sync releases the fail-closed rule');
  assert.deepEqual(JSON.parse(JSON.stringify(extension.dynamicRules)), [{
    id: 1,
    priority: 1,
    action: { type: 'block' },
    condition: { requestDomains: ['blocked.example'], resourceTypes: ['main_frame'] },
  }]);

  extension.webNavigation.onBeforeNavigate.emit({ frameId: 0, tabId: 1, url: 'https://allowed.example/' });
  assert.equal(extension.nativeMessages.some(message => message.type === 'blocked'), false);

  extension.webNavigation.onBeforeNavigate.emit({ frameId: 0, tabId: 1, url: 'https://blocked.example/path' });
  assert.equal(extension.nativeMessages.some(message => message.type === 'blocked' && message.url === 'https://blocked.example/path'), true);
}

test('Chrome worker syncs a DNR block rule and reports blocked navigation', async () => {
  const extension = await startExtension({
    browserFamily: 'chrome', rules: blockedRule,
    userAgent: 'Mozilla/5.0 Chrome/155.0.0.0 Safari/537.36',
  });
  assertBlockedNavigation(extension);
  assert.equal(extension.nativeMessages.some(message => message.type === 'health' && message.browserFamily === 'chrome' && message.ok), true);
});

test('Chromium reports a blocked navigation that arrives before its first state sync', async () => {
  const extension = await startExtension({
    browserFamily: 'chrome',
    rules: blockedRule,
    userAgent: 'Mozilla/5.0 Chrome/155.0.0.0 Safari/537.36',
    deferStateReplies: true,
    awaitSync: false,
  });

  const navigation = { frameId: 0, tabId: 8, url: 'https://blocked.example/path' };
  extension.webNavigation.onBeforeNavigate.emit(navigation);
  assert.equal(extension.nativeMessages.some(message => message.type === 'blocked'), false);

  await extension.replyToNextStateRequest();
  assert.equal(extension.nativeMessages.some(message => message.type === 'blocked'), false);
  await extension.replyToNextStateRequest();
  await extension.waitForSync();

  assert.equal(extension.nativeMessages.filter(message => (
    message.type === 'blocked' && message.url === navigation.url
  )).length, 1);
  extension.webNavigation.onErrorOccurred.emit(navigation);
  assert.equal(extension.nativeMessages.filter(message => (
    message.type === 'blocked' && message.url === navigation.url
  )).length, 1, 'the matching onErrorOccurred event is deduplicated');
});

test('Chromium restores its heartbeat alarm when an installed extension starts with the browser', async () => {
  const extension = await startExtension({
    browserFamily: 'chrome',
    rules: blockedRule,
    userAgent: 'Mozilla/5.0 Chrome/155.0.0.0 Safari/537.36',
    startupOnLoad: true,
  });

  assert.deepEqual(JSON.parse(JSON.stringify(extension.alarmsCreated)), [{
    name: 'locky-refresh',
    alarmInfo: { periodInMinutes: 0.5 },
  }]);
});

test('Chromium reschedules an existing heartbeat alarm when its worker starts', async () => {
  const extension = await startExtension({
    browserFamily: 'chrome',
    rules: blockedRule,
    userAgent: 'Mozilla/5.0 Chrome/155.0.0.0 Safari/537.36',
    refreshAlarmExists: true,
  });

  assert.deepEqual(JSON.parse(JSON.stringify(extension.alarmsCreated)), [{
    name: 'locky-refresh',
    alarmInfo: { periodInMinutes: 0.5 },
  }]);
});

test('Chromium reports its native connection while the fail-closed rule is active', async () => {
  const extension = await startExtension({
    browserFamily: 'chrome', rules: blockedRule,
    userAgent: 'Mozilla/5.0 Chrome/155.0.0.0 Safari/537.36',
  });

  assert.deepEqual(extension.guardAtConnectionReports, [true]);
  assert.equal(extension.nativeMessages.some(message => (
    message.type === 'connected' && message.browserFamily === 'chrome'
  )), true);
});

test('Brave connects when Locky starts after the extension and keeps fail-closed protection meanwhile', async () => {
  const extension = await startExtension({
    browserFamily: 'brave',
    brave: true,
    rules: blockedRule,
    userAgent: 'Mozilla/5.0 Chrome/155.0.0.0 Safari/537.36',
    nativeUnavailable: true,
    awaitSync: false,
  });
  await flushMicrotasks();
  assert.equal(extension.nativeMessages.some(message => message.type === 'getState'), false);
  assert.equal(extension.sessionRules.some(rule => rule.id === 5001), true);

  extension.setNativeAvailable(true);
  assert.equal(extension.runNextTimeout(), 3000);
  await extension.waitForSync();

  assert.ok(extension.getNativeConnectCount() >= 3);
  assert.equal(extension.nativeMessages.some(message => message.type === 'connected' && message.browserFamily === 'brave'), true);
  assert.equal(extension.nativeMessages.some(message => message.type === 'health' && message.browserFamily === 'brave' && message.ok), true);
  assert.equal(extension.sessionRules.some(rule => rule.id === 5001), false);
});

test('Brave reconnects and resynchronizes after Locky restarts with the browser open', async () => {
  const extension = await startExtension({
    browserFamily: 'brave',
    brave: true,
    rules: blockedRule,
    userAgent: 'Mozilla/5.0 Chrome/155.0.0.0 Safari/537.36',
  });
  const connectionsBeforeRestart = extension.nativeMessages.filter(message => message.type === 'connected').length;

  extension.disconnect();
  await flushMicrotasks();
  assert.equal(extension.sessionRules.some(rule => rule.id === 5001), true);
  assert.equal(extension.runNextTimeout(), 3000);
  await extension.waitForSync();

  assert.ok(extension.nativeMessages.filter(message => message.type === 'connected').length > connectionsBeforeRestart);
  assert.equal(extension.nativeMessages.some(message => message.type === 'health' && message.browserFamily === 'brave' && message.ok), true);
  assert.equal(extension.sessionRules.some(rule => rule.id === 5001), false);
});

test('Brave refreshes native state after a service-worker wake alarm', async () => {
  const extension = await startExtension({
    browserFamily: 'brave',
    brave: true,
    rules: blockedRule,
    userAgent: 'Mozilla/5.0 Chrome/155.0.0.0 Safari/537.36',
  });
  const stateRequestsBeforeWake = extension.nativeMessages.filter(message => message.type === 'getState').length;

  extension.fireRefreshAlarm();
  await extension.waitForSync();

  assert.ok(extension.nativeMessages.filter(message => message.type === 'getState').length > stateRequestsBeforeWake);
  assert.equal(extension.nativeMessages.some(message => message.type === 'health' && message.browserFamily === 'brave' && message.ok), true);
});

test('Brave reconnects when a native state request stops answering', async () => {
  const extension = await startExtension({
    browserFamily: 'brave', brave: true,
    rules: blockedRule,
    userAgent: 'Mozilla/5.0 Chrome/155.0.0.0 Safari/537.36',
    deferStateReplies: true,
    awaitSync: false,
  });
  const connectionsBefore = extension.getNativeConnectCount();
  extension.advanceTime(16_000);
  extension.fireRefreshAlarm();
  await flushMicrotasks();
  assert.ok(extension.getNativeConnectCount() > connectionsBefore);
  assert.ok(extension.nativeMessages.filter(message => message.type === 'getState').length >= 2);
  assert.ok(extension.sessionRules.some(rule => rule.id === 5001));
});

test('Chromium worker identifies Brave and Edge while syncing the same rule contract', async t => {
  const variants = [
    { name: 'Brave', browserFamily: 'brave', userAgent: 'Mozilla/5.0 Chrome/155.0.0.0 Safari/537.36', brave: true },
    { name: 'Edge', browserFamily: 'edge', userAgent: 'Mozilla/5.0 Chrome/155.0.0.0 Safari/537.36 Edg/155.0.0.0' },
  ];
  for (const variant of variants) {
    await t.test(variant.name, async () => {
      const extension = await startExtension({ ...variant, rules: blockedRule });
      assertBlockedNavigation(extension);
      assert.equal(extension.nativeMessages.some(message => message.type === 'health' && message.browserFamily === variant.browserFamily && message.ok), true);
    });
  }
});

test('Firefox worker syncs a DNR block rule and reports blocked navigation', async () => {
  const extension = await startExtension({
    browserFamily: 'firefox', rules: blockedRule,
    userAgent: 'Mozilla/5.0 Firefox/128.0',
  });
  assertBlockedNavigation(extension);
  assert.equal(extension.nativeMessages.some(message => message.type === 'health' && message.browserFamily === 'firefox' && message.ok), true);
});

test('Firefox reports a prohibited page when DNR surfaces the block as a navigation error', async () => {
  const extension = await startExtension({
    browserFamily: 'firefox',
    rules: [{ id: 'route-1', type: 'path', host: 'allowed.example', path: '/blocked' }],
    userAgent: 'Mozilla/5.0 Firefox/128.0',
  });

  extension.webNavigation.onErrorOccurred.emit({
    frameId: 0,
    tabId: 7,
    url: 'https://allowed.example/blocked/post/1',
    error: 'NS_ERROR_ABORT',
  });

  assert.equal(extension.nativeMessages.some(message => (
    message.type === 'blocked' && message.url === 'https://allowed.example/blocked/post/1'
  )), true);
});

test('Chromium blocks web navigation while Locky is disconnected', async () => {
  const extension = await startExtension({
    browserFamily: 'chrome', rules: blockedRule,
    userAgent: 'Mozilla/5.0 Chrome/155.0.0.0 Safari/537.36',
  });

  extension.disconnect();
  await new Promise(resolve => setTimeout(resolve, 0));

  assert.equal(extension.sessionRules.some(rule => rule.action.type === 'block'
    && rule.priority === 1000
    && rule.condition.resourceTypes.includes('main_frame')), true);
});
