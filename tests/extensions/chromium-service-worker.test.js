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

async function startChromiumExtension(rules) {
  const nativeMessages = [];
  const dynamicRules = [];
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
    navigator: { userAgent: 'Mozilla/5.0 Chrome/155.0.0.0 Safari/537.36' },
    chrome: {
      runtime: {
        connectNative: () => nativePort,
        onInstalled: event(),
        onStartup: event(),
      },
      alarms: { create() {}, onAlarm: event() },
      declarativeNetRequest: {
        async getDynamicRules() { return dynamicRules; },
        async updateDynamicRules({ removeRuleIds, addRules }) {
          for (const id of removeRuleIds) {
            const index = dynamicRules.findIndex(rule => rule.id === id);
            if (index >= 0) dynamicRules.splice(index, 1);
          }
          dynamicRules.push(...addRules);
          ready();
        },
      },
      webNavigation: { onBeforeNavigate: event() },
    },
  };
  const vmContext = vm.createContext(context);
  context.importScripts = file => {
    const source = readFileSync(path.join(projectRoot, 'extensions/chromium', file), 'utf8');
    vm.runInContext(source, vmContext);
  };
  const source = await readFile(path.join(projectRoot, 'extensions/chromium/service-worker.js'), 'utf8');
  vm.runInContext(source, vmContext);
  await updated;
  return { nativeMessages, dynamicRules, webNavigation: context.chrome.webNavigation };
}

test('Chrome DNR rules are synced and blocked-navigation attempts are reported', async () => {
  const extension = await startChromiumExtension([
    { id: 'rule-1', type: 'domain', host: 'blocked.example', path: '/' },
  ]);

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
});
