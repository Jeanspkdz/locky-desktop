import test from 'node:test';
import assert from 'node:assert/strict';
import { integrationFailureReason, shouldEnforceBrowserIntegration } from '../../src/domain/browser-health.js';

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

test('a stale integration heartbeat is marked for repair', () => {
  assert.equal(integrationFailureReason({ startedAt: 1000, lastHealthyAt: 1000 }, 61_001), 'stale');
});

test('a recent integration heartbeat keeps the browser healthy', () => {
  assert.equal(integrationFailureReason({ startedAt: 1000, lastHealthyAt: 10_000 }, 70_000), null);
});
