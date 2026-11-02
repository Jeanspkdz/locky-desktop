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

async function startExtension({ browserFamily, rules, userAgent, brave = false }) {
  const nativeMessages = [];
  const dynamicRules = [];
  const sessionRules = [];
  let ready;
  const updated = new Promise(resolve => { ready = resolve; });
  const nativePort = {
    onDisconnect: event(),
    onMessage: event(),
    postMessage(message) {
      nativeMessages.push(message);
      if (message.type !== 'getState') return;
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
    },
  };
  const context = {
    URL,
    Map,
    Set,
    Date,
    JSON,
    Promise,
    queueMicrotask,
    setTimeout,
    navigator: { userAgent, ...(brave ? { brave: {} } : {}) },
  };
  const browserApi = {
      runtime: {
        connectNative: () => nativePort,
        onInstalled: event(),
        onStartup: event(),
      },
      alarms: { create() {}, onAlarm: event() },
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
  await updated;
  await new Promise(resolve => setTimeout(resolve, 0));
  return {
    nativeMessages,
    dynamicRules,
    sessionRules,
    webNavigation: browserApi.webNavigation,
    disconnect() { nativePort.onDisconnect.emit(); },
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
