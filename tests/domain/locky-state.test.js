import test from 'node:test';
import assert from 'node:assert/strict';
import { addPendingRule, cancelPendingRule, consolidateExpiredRules, startDesktopLock } from '../../src/domain/locky-state.js';

const rule = { id: 'rule-1', type: 'domain', host: 'example.com', path: '/', source: 'user' };

test('una regla nueva queda pendiente durante diez minutos y luego se consolida', () => {
  const initial = { rules: [], pendingRules: [] };
  const pending = addPendingRule(initial, rule, 1_000);

  assert.equal(pending.pendingRules[0].consolidatesAt, 601_000);
  assert.equal(consolidateExpiredRules(pending, 600_999).rules.length, 0);

  const expired = consolidateExpiredRules(pending, 601_000);
  assert.equal(expired.rules[0].id, rule.id);
  assert.equal(expired.pendingRules.length, 0);
});

test('la persona puede cancelar la regla pendiente, pero no una ya consolidada', () => {
  const pending = addPendingRule({ rules: [], pendingRules: [] }, rule, 1_000);

  assert.equal(cancelPendingRule(pending, rule.id).pendingRules.length, 0);
  assert.equal(cancelPendingRule({ rules: [rule], pendingRules: [] }, rule.id).rules.length, 1);
});

test('el bloqueo dura siete minutos y un intento durante el bloqueo no reinicia el tiempo', () => {
  const first = startDesktopLock(null, 1_000);
  const repeated = startDesktopLock(first, 100_000);

  assert.equal(first.endsAt, 421_000);
  assert.equal(repeated.endsAt, first.endsAt);
});

test('después de vencer se inicia un período nuevo de siete minutos', () => {
  const first = startDesktopLock(null, 1_000);
  const second = startDesktopLock(first, first.endsAt);

  assert.equal(second.endsAt, first.endsAt + 420_000);
});
