import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBrowserRuntime,
  evaluateBrowserIntegration,
  integrationFailureReason,
  shouldEnforceBrowserIntegration,
  resetBrowserHealthForStartup,
} from '../../src/domain/browser-health.js';

test('startup discards persisted browser health until each browser is checked again', () => {
  const oldHealth = {
    chrome: { status: 'repair', reason: 'missing' },
    edge: { status: 'repair', reason: 'stale' },
    brave: { status: 'healthy' },
  };
  assert.deepEqual(resetBrowserHealthForStartup(oldHealth), {
    chrome: { status: 'idle' },
    edge: { status: 'idle' },
    brave: { status: 'idle' },
  });
  assert.equal(oldHealth.chrome.status, 'repair');
});

test('an unconfigured browser stays open while there are no consolidated rules', () => {
  assert.equal(shouldEnforceBrowserIntegration(true, []), false);
  assert.equal(shouldEnforceBrowserIntegration(true, [{ id: 'rule-1' }]), true);
  assert.equal(shouldEnforceBrowserIntegration(false, [{ id: 'rule-1' }]), false);
});

test('a browser can start its integration during the launch grace period', () => {
  assert.equal(integrationFailureReason({ startedAt: 1000 }, 15_999), null);
});

test('a browser without a healthy integration is marked for repair after startup grace', () => {
  assert.equal(integrationFailureReason({ startedAt: 1000 }, 16_000), 'missing');
});

test('a connected browser gets time to finish syncing rules under the fail-closed guard', () => {
  const runtime = { startedAt: 1000, lastConnectedAt: 15_000 };
  assert.equal(integrationFailureReason(runtime, 59_999), null);
  assert.equal(integrationFailureReason(runtime, 60_000), null);
  assert.equal(integrationFailureReason(runtime, 60_001), 'stale');
});

test('a stale integration heartbeat is marked for repair', () => {
  assert.equal(integrationFailureReason({ startedAt: 1000, lastHealthyAt: 1000 }, 61_001), 'stale');
});

test('a recent integration heartbeat keeps the browser healthy', () => {
  assert.equal(integrationFailureReason({ startedAt: 1000, lastHealthyAt: 10_000 }, 70_000), null);
});

test('a Locky restart gives already-open Brave a fresh verification grace period', () => {
  const runtime = createBrowserRuntime(50_000);

  assert.deepEqual(runtime, { startedAt: 50_000, lastHealthyAt: null, lastConnectedAt: null });
  assert.equal(integrationFailureReason(runtime, 50_001), null);
  assert.equal(integrationFailureReason(runtime, 65_000), 'missing');
});

test('an unverified Brave closes only when enforcement and blocking rules are active', () => {
  const runtime = createBrowserRuntime(1000);
  const rule = { id: 'blocked-domain' };

  assert.deepEqual(evaluateBrowserIntegration(runtime, 16_000, true, [rule]), {
    failure: 'missing',
    closeBrowser: true,
  });
  assert.deepEqual(evaluateBrowserIntegration(runtime, 16_000, true, []), {
    failure: 'missing',
    closeBrowser: false,
  });
  assert.deepEqual(evaluateBrowserIntegration({ ...runtime, lastHealthyAt: 15_999 }, 16_000, true, [rule]), {
    failure: null,
    closeBrowser: false,
  });
});
