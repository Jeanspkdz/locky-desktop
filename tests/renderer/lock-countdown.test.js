import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

test('the countdown never increases when a fresh update follows a local tick', () => {
  const output = { textContent: '' };
  let onRemaining;
  let tick;
  let now = 0;
  const context = {
    document: { querySelector: () => output },
    window: { locky: { onLockRemaining: callback => { onRemaining = callback; } } },
    performance: { now: () => now },
    setInterval: callback => { tick = callback; },
  };
  vm.runInNewContext(readFileSync(new URL('../../src/renderer/lock.js', import.meta.url), 'utf8'), context);
  onRemaining(419000);
  assert.equal(output.textContent, '06:59');
  now = 1000;
  tick();
  assert.equal(output.textContent, '06:58');
  onRemaining(418500);
  assert.equal(output.textContent, '06:58');
});
