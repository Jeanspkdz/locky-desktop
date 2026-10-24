import test from 'node:test';
import assert from 'node:assert/strict';
import '../../extensions/chromium/rule-builder.js';
import { assertRuleCapacity, assertRuleSetCapacity } from '../../src/domain/rules.js';
const { findBrowserRule, toBrowserRules } = globalThis.LockyRules;

test('reglas del navegador bloquean un dominio entero y subdominios', () => {
  const rules = [{ id: 'r1', type: 'domain', host: 'example.com', path: '/' }];
  assert.equal(findBrowserRule('https://video.example.com/a', rules).id, 'r1');
  assert.equal(findBrowserRule('https://notexample.com/a', rules), null);
});

test('reglas del navegador bloquean una ruta anidada sin alcanzar prefijos parecidos', () => {
  const rules = [{ id: 'r2', type: 'path', host: 'x.com', path: '/profileA' }];
  assert.equal(findBrowserRule('https://x.com/profileA/status/12', rules).id, 'r2');
  assert.equal(findBrowserRule('https://x.com/profileA?source=home', rules).id, 'r2');
  assert.equal(findBrowserRule('https://x.com/profileAB', rules), null);
  assert.equal(findBrowserRule('https://x.com/home', rules), null);
});

test('el navegador recibe reglas DNR solo para navegaciones principales', () => {
  const [rule] = toBrowserRules([{ type: 'path', host: 'x.com', path: '/profileA' }]);
  assert.equal(rule.condition.resourceTypes[0], 'main_frame');
  assert.equal(rule.action.type, 'block');
  assert.match(rule.condition.regexFilter, /profileA/);
});

test('las reglas de dominio usan condiciones por dominio y no consumen expresiones regulares', () => {
  const [rule] = toBrowserRules([{ type: 'domain', host: 'example.com' }]);
  assert.deepEqual(rule.condition.requestDomains, ['example.com']);
  assert.equal(rule.condition.regexFilter, undefined);
});

test('agrupa dominios en tandas pequeñas para aprovechar la cuota de DNR', () => {
  const rules = Array.from({ length: 201 }, (_, index) => ({ type: 'domain', host: `site${index}.example` }));
  const browserRules = toBrowserRules(rules);
  assert.equal(browserRules.length, 3);
  assert.deepEqual(browserRules.map(rule => rule.condition.requestDomains.length), [100, 100, 1]);
});

test('no se acepta una regla que excedería la cuota común de reglas dinámicas', () => {
  const domains = Array.from({ length: 400_000 }, (_, id) => ({ type: 'domain', host: `d${id}.example` }));
  const existing = [...domains, ...Array.from({ length: 1000 }, (_, id) => ({ id, type: 'path' }))];
  assert.throws(() => assertRuleCapacity(existing, { type: 'domain' }), /5,000/);
});

test('no se acepta una ruta que excedería el máximo compartido de expresiones regulares', () => {
  const existing = Array.from({ length: 1000 }, (_, id) => ({ id, type: 'path' }));
  assert.throws(() => assertRuleCapacity(existing, { type: 'path' }), /1,000/);
});

test('la capacidad se calcula sobre las reglas DNR agrupadas, no sobre los dominios individuales', () => {
  const domains = Array.from({ length: 50_000 }, (_, id) => ({ type: 'domain', host: `d${id}.example` }));
  assert.doesNotThrow(() => assertRuleSetCapacity(domains));
});
