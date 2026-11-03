import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createRetryingBrowserWatcher } = require('../../src/main/retrying-browser-watcher.cjs');

test('a watcher construction failure is retried on the next monitor cycle', () => {
  let attempts = 0;
  const watcher = createRetryingBrowserWatcher(() => {
    attempts += 1;
    if (attempts === 1) throw new Error('Koffi could not load.');
    return { snapshot: () => ({ families: ['brave'], windows: [] }) };
  });

  assert.throws(() => watcher.snapshot(), /Koffi could not load/);
  assert.deepEqual(watcher.snapshot(), { families: ['brave'], windows: [] });
  assert.equal(attempts, 2);
});

test('a snapshot failure rebuilds the watcher before the next retry', () => {
  let builds = 0;
  const watcher = createRetryingBrowserWatcher(() => {
    builds += 1;
    return { snapshot: () => {
      if (builds === 1) throw new Error('Windows snapshot failed.');
      return { families: ['brave'], windows: [] };
    } };
  });

  assert.throws(() => watcher.snapshot(), /Windows snapshot failed/);
  assert.deepEqual(watcher.snapshot(), { families: ['brave'], windows: [] });
  assert.equal(builds, 2);
});
