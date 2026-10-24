import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { StateStore } = require('../../src/main/state-store.cjs');

test('browser rules and pending timers survive creating a new store instance', async t => {
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
    candidateList: [],
    candidateListCheckedAt: null,
    browserHealth: {},
  };

  const store = new StateStore(filePath);
  await store.write(state);
  assert.deepEqual(await new StateStore(filePath).read(), state);
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
