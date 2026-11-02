import test from 'node:test';
import assert from 'node:assert/strict';
import { getProtectionStatus } from '../../src/domain/protection-status.js';

test('reports that there are no blocking rules before any pages are added', () => {
  assert.equal(getProtectionStatus({ rules: [], browserHealth: { chrome: { status: 'healthy' } } }), 'Sin reglas bloqueantes');
});

test('does not claim protection when an integration needs repair', () => {
  assert.equal(getProtectionStatus({
    rules: [{ id: '1' }, { id: '2' }],
    browserHealth: { chrome: { status: 'repair' } },
  }), '2 reglas · integración por reparar');
});

test('reports rule count without claiming an unverified browser is protected', () => {
  assert.equal(getProtectionStatus({ rules: [{ id: '1' }], browserHealth: {} }), '1 regla guardada');
});

test('reports integration checks while a browser is starting', () => {
  assert.equal(getProtectionStatus({
    rules: [{ id: '1' }],
    browserHealth: { edge: { status: 'checking' } },
  }), '1 regla · comprobando integración');
});
