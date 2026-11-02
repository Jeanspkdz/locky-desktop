import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { getRuntimeConfig } = require('../../src/main/runtime-config.cjs');

test('Locky keeps its normal data path, pipe, and overlays outside test mode', () => {
  assert.deepEqual(getRuntimeConfig({}), {
    pipeName: 'locky-desktop',
    userDataPath: null,
    suppressOverlays: false,
    hideSettingsWindow: false,
  });
});

test('isolated browser tests can use a disposable state path and pipe without overlays', () => {
  const config = getRuntimeConfig({
    LOCKY_TEST_MODE: '1',
    LOCKY_TEST_USER_DATA_DIR: '.tmp/browser-test-state',
    LOCKY_TEST_PIPE_NAME: 'locky-test-session',
    LOCKY_TEST_NO_OVERLAY: '1',
    LOCKY_TEST_HIDE_SETTINGS: '1',
  });

  assert.deepEqual(config, {
    pipeName: 'locky-test-session',
    userDataPath: path.resolve('.tmp/browser-test-state'),
    suppressOverlays: true,
    hideSettingsWindow: true,
  });
});

test('test-only overrides are ignored unless test mode is explicitly enabled', () => {
  assert.equal(getRuntimeConfig({
    LOCKY_TEST_USER_DATA_DIR: '.tmp/ignored',
    LOCKY_TEST_PIPE_NAME: 'ignored',
    LOCKY_TEST_NO_OVERLAY: '1',
    LOCKY_TEST_HIDE_SETTINGS: '1',
  }).pipeName, 'locky-desktop');
});
