import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const protectedBrowsers = require('../../src/domain/protected-browser-families.cjs');
const { BROWSER_PROCESS_GROUPS: healthProcessGroups } = await import('../../src/domain/browser-health.js');
const { familyForProcessName } = require('../../src/main/windows-browser-watcher.cjs');

test('the CommonJS process map is the browser-health source of truth', () => {
  assert.strictEqual(healthProcessGroups, protectedBrowsers.BROWSER_PROCESS_GROUPS);
  assert.deepEqual(Object.keys(healthProcessGroups), ['chrome', 'brave', 'edge']);
});

test('the window watcher recognizes only protected browser process images', () => {
  assert.equal(familyForProcessName('chrome.exe'), 'chrome');
  assert.equal(familyForProcessName('brave.exe'), 'brave');
  assert.equal(familyForProcessName('msedge.exe'), 'edge');
  assert.equal(familyForProcessName('firefox.exe'), null);
  assert.equal(familyForProcessName('opera.exe'), null);
  assert.equal(familyForProcessName('opera_gx.exe'), null);
});

test('watcher failure policy excludes unsupported families even in stale observations', () => {
  const { createBrowserProcessControl } = require('../../src/main/browser-process-control.cjs');
  const processControl = createBrowserProcessControl({ execute: async () => {} });

  assert.deepEqual(
    processControl.familiesForWatcherFailure(['firefox', 'opera', 'chrome']),
    ['chrome', 'brave', 'edge'],
  );
});
