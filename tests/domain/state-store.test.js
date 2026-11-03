import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { StateStore } = require('../../src/main/state-store.cjs');
const { remainingLockMs } = await import('../../src/domain/locky-state.js');

test('an absent state file loads a safe empty state', async t => {
  const directory = await fs.mkdtemp(path.join(process.cwd(), '.scratch', 'locky-store-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const state = await new StateStore(path.join(directory, 'missing.json')).read();

  assert.equal(state.revision, 0);
  assert.deepEqual(state.rules, []);
  assert.deepEqual(state.pendingRules, []);
  assert.equal(state.desktopLock, null);
  assert.deepEqual(state.browserHealth, {});
});

test('rules, pending timers, and offline lock expiry survive creating a new store instance', async t => {
  const directory = await fs.mkdtemp(path.join(process.cwd(), '.scratch', 'locky-store-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, 'state.json');
  const state = {
    version: 1,
    revision: 0,
    rulesRevision: 0,
    rules: [{ id: 'fixed', type: 'domain', host: 'example.com' }],
    pendingRules: [{ id: 'pending', type: 'path', host: 'social.example', path: '/user', consolidatesAt: 1234 }],
    desktopLock: { startedAt: 5, endsAt: 420005 },
    candidateListApproved: false,
    candidateListApprovedAt: null,
    candidateList: [],
    candidateListCheckedAt: null,
    browserHealth: {},
  };

  const store = new StateStore(filePath);
  await store.write(state);
  const restored = await new StateStore(filePath).read();
  assert.deepEqual(restored, state);
  assert.equal(remainingLockMs(restored.desktopLock, 180_005), 240_000);
  assert.equal(remainingLockMs(restored.desktopLock, restored.desktopLock.endsAt), 0);
  await store.write({ ...state, rules: [...state.rules, { id: 'second', type: 'domain', host: 'another.example' }] });
  assert.equal((await new StateStore(filePath).read()).rules.length, 2);
});

test('a corrupt state file is surfaced instead of silently dropping permanent rules', async t => {
  const directory = await fs.mkdtemp(path.join(process.cwd(), '.scratch', 'locky-store-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, 'state.json');
  await fs.writeFile(filePath, '{broken json', 'utf8');

  await assert.rejects(new StateStore(filePath).read(), /estado/i);
});

test('a failed state write does not poison later writes after the filesystem recovers', async t => {
  const directory = await fs.mkdtemp(path.join(process.cwd(), '.scratch', 'locky-store-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const parentPath = path.join(directory, 'blocked-parent');
  await fs.writeFile(parentPath, 'file instead of directory');
  const store = new StateStore(path.join(parentPath, 'state.json'));

  await assert.rejects(store.write({ version: 1, rules: [] }));
  await fs.rm(parentPath);
  await fs.mkdir(parentPath);
  await store.write({ version: 1, rules: [{ id: 'recovered' }] });

  assert.deepEqual(JSON.parse(await fs.readFile(path.join(parentPath, 'state.json'), 'utf8')).rules, [{ id: 'recovered' }]);
});
