import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createBrowserProcessScopeReader } = require('../../src/main/browser-process-scope.cjs');

test('normal Locky runs have no browser process scope', () => {
  const readScope = createBrowserProcessScopeReader({ testMode: false });

  assert.equal(readScope(), null);
});

test('test mode with no scope file watches and closes no browser processes', () => {
  const readScope = createBrowserProcessScopeReader({ testMode: true });

  assert.deepEqual(readScope(), {});
});

test('a test scope exposes only valid PIDs for protected browser families', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'locky-browser-scope-'));
  const scopePath = path.join(directory, 'scope.json');
  try {
    await writeFile(scopePath, JSON.stringify({
      chrome: [101, 0, -1, '102'],
      brave: [201],
      edge: [301],
      firefox: [401],
    }));
    const readScope = createBrowserProcessScopeReader({ testMode: true, filePath: scopePath });

    assert.deepEqual(readScope(), { chrome: [101], brave: [201], edge: [301] });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('a missing or malformed test scope fails closed to no browser processes', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'locky-browser-scope-'));
  const scopePath = path.join(directory, 'scope.json');
  try {
    const readScope = createBrowserProcessScopeReader({ testMode: true, filePath: scopePath });
    assert.deepEqual(readScope(), {});

    await writeFile(scopePath, '{invalid');
    assert.deepEqual(readScope(), {});
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
