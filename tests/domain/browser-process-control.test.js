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
