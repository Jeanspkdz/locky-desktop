import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesRule, normalizeRule } from '../../src/domain/rules.js';

test('una regla de dominio cubre el dominio y sus subdominios', () => {
  const rule = normalizeRule({ type: 'domain', value: 'example.com' });

  assert.equal(matchesRule('https://example.com/path', rule), true);
  assert.equal(matchesRule('https://video.example.com/path', rule), true);
  assert.equal(matchesRule('https://notexample.com/path', rule), false);
});

test('una regla de ruta cubre las rutas descendientes, no los prefijos parecidos', () => {
  const rule = normalizeRule({ type: 'path', value: 'https://x.com/influencerA' });

  assert.equal(matchesRule('https://x.com/influencerA', rule), true);
  assert.equal(matchesRule('https://x.com/influencerA/status/123', rule), true);
  assert.equal(matchesRule('https://x.com/influencerAB', rule), false);
  assert.equal(matchesRule('https://x.com/another', rule), false);
});

test('una ruta de perfil no bloquea otros perfiles o el resto del sitio', () => {
  const rule = normalizeRule({ type: 'path', value: 'https://x.com/influencerA' });

  assert.equal(matchesRule('https://x.com/influencerB', rule), false);
  assert.equal(matchesRule('https://x.com/home', rule), false);
});

test('las reglas rechazan entradas que no sean URL web válidas', () => {
  assert.throws(() => normalizeRule({ type: 'domain', value: 'https://example.com/a' }), /dominio/);
  assert.throws(() => normalizeRule({ type: 'path', value: 'file:///C:/secret' }), /http/);
});
