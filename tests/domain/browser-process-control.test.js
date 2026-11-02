import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createBrowserProcessControl } = require('../../src/main/browser-process-control.cjs');

for (const [label, family, executable] of [
  ['Chrome', 'chrome', 'chrome.exe'],
  ['Brave', 'brave', 'brave.exe'],
  ['Edge', 'edge', 'msedge.exe'],
]) {
  test(`repairing ${label} only requests closure of ${executable}`, async () => {
    const requests = [];
    const processControl = createBrowserProcessControl({
      execute: async (...args) => { requests.push(args); },
    });

    await processControl.closeFamily(family);

    assert.deepEqual(requests, [[
      'taskkill.exe',
      ['/IM', executable, '/T', '/F'],
      { windowsHide: true },
    ]]);
  });
}

test('the shared repair action closes only Chrome, Brave, and Edge', async () => {
  const requests = [];
  const processControl = createBrowserProcessControl({
    execute: async (...args) => { requests.push(args); },
  });

  await processControl.closeProtectedBrowsers();

  assert.deepEqual(requests.map(([, args]) => args[1]), ['chrome.exe', 'brave.exe', 'msedge.exe']);
});

test('Firefox and Opera are not protected, detected, or closed by repair flows', async () => {
  const requests = [];
  const processControl = createBrowserProcessControl({
    execute: async (...args) => { requests.push(args); },
  });

  assert.deepEqual(processControl.families, ['chrome', 'brave', 'edge']);
  for (const family of ['firefox', 'opera']) {
    assert.equal(processControl.hasFamily(family), false);
    await processControl.closeFamily(family);
  }
  assert.deepEqual(requests, []);
});

test('a watcher failure closes and marks only protected browser families', async () => {
  const requests = [];
  const processControl = createBrowserProcessControl({
    execute: async (...args) => { requests.push(args); },
  });

  const families = processControl.familiesForWatcherFailure(['chrome', 'firefox', 'opera']);
  await Promise.all(families.map(family => processControl.closeFamily(family)));

  assert.deepEqual(families, ['chrome', 'brave', 'edge']);
  assert.deepEqual(requests.map(([, args]) => args[1]), ['chrome.exe', 'brave.exe', 'msedge.exe']);
});

test('test-scoped repair closes only allowlisted browser PIDs', async () => {
  const requests = [];
  const processControl = createBrowserProcessControl({
    execute: async (...args) => { requests.push(args); },
    getProcessIds: family => ({ chrome: [101], brave: [201, 202], edge: [301] })[family] ?? [],
  });

  await processControl.closeProtectedBrowsers();

  assert.deepEqual(requests.map(([, args]) => args), [
    ['/PID', '101', '/T', '/F'],
    ['/PID', '201', '/T', '/F'],
    ['/PID', '202', '/T', '/F'],
    ['/PID', '301', '/T', '/F'],
  ]);
});

test('an empty test process scope never falls back to image-wide closure', async () => {
  const requests = [];
  const processControl = createBrowserProcessControl({
    execute: async (...args) => { requests.push(args); },
    getProcessIds: () => [],
  });

  await processControl.closeProtectedBrowsers();

  assert.deepEqual(requests, []);
});
