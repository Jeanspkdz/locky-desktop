import test from 'node:test';
import assert from 'node:assert/strict';
import { SessionClock } from '../../src/domain/session-clock.js';

test('la hora de sesión avanza con un reloj monotónico anclado a hora verificada', () => {
  let monotonic = 100;
  const clock = new SessionClock(() => monotonic);
  assert.equal(clock.ready, false);
  clock.anchor(1_000_000);
  monotonic += 2500;
  assert.equal(clock.now(), 1_002_500);
});

test('la hora de sesión no cambia con el reloj civil de Windows', () => {
  let monotonic = 100;
  const clock = new SessionClock(() => monotonic);
  clock.anchor(1_000_000);
  monotonic += 6000;
  assert.equal(clock.now(), 1_006_000);
});
