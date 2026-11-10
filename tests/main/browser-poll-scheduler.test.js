import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createBrowserPollScheduler } = require('../../src/main/browser-poll-scheduler.cjs');

function createFakeTimers() {
  let nextId = 1;
  const timers = new Map();
  return {
    timers,
    setTimeout(callback, delay) {
      const id = nextId++;
      timers.set(id, { callback, delay });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    async runNext(delay) {
      const entry = [...timers.entries()].find(([, timer]) => timer.delay === delay);
      assert.ok(entry, `expected a pending ${delay} ms timer`);
      const [id, timer] = entry;
      timers.delete(id);
      timer.callback();
      await Promise.resolve();
      await Promise.resolve();
    },
  };
}

test('browser detection stays at 3 seconds while window tracking is absent outside a lock', async () => {
  const clock = createFakeTimers();
  let detections = 0;
  let tracks = 0;
  let lockActive = false;
  const scheduler = createBrowserPollScheduler({
    detectBrowsers: () => { detections += 1; },
    trackWindows: () => { tracks += 1; },
    isLockActive: () => lockActive,
    setTimeoutFn: clock.setTimeout,
    clearTimeoutFn: clock.clearTimeout,
  });

  scheduler.start();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(detections, 1);
  assert.equal(tracks, 0);
  assert.deepEqual([...clock.timers.values()].map(timer => timer.delay), [3000]);

  await clock.runNext(3000);
  assert.equal(detections, 2);
  assert.deepEqual([...clock.timers.values()].map(timer => timer.delay), [3000]);

  scheduler.stop();
  assert.equal(clock.timers.size, 0);
});

test('a restored active lock starts window tracking immediately', async () => {
  const clock = createFakeTimers();
  let tracks = 0;
  const scheduler = createBrowserPollScheduler({
    detectBrowsers: () => {},
    trackWindows: () => { tracks += 1; },
    isLockActive: () => true,
    setTimeoutFn: clock.setTimeout,
    clearTimeoutFn: clock.clearTimeout,
  });

  scheduler.start();
  assert.equal(tracks, 1);
  assert.deepEqual([...clock.timers.values()].map(timer => timer.delay).sort((a, b) => a - b), [500]);
  scheduler.stop();
  await Promise.resolve();
  assert.equal(clock.timers.size, 0);
});

test('window tracking enumerates immediately at lock start and repeats every 500 ms until expiry', async () => {
  const clock = createFakeTimers();
  let detections = 0;
  let tracks = 0;
  let inactive = 0;
  let lockActive = false;
  const scheduler = createBrowserPollScheduler({
    detectBrowsers: () => { detections += 1; },
    trackWindows: () => { tracks += 1; },
    isLockActive: () => lockActive,
    setTimeoutFn: clock.setTimeout,
    clearTimeoutFn: clock.clearTimeout,
    onLockInactive: () => { inactive += 1; },
  });

  scheduler.start();
  await Promise.resolve();
  await Promise.resolve();
  lockActive = true;
  scheduler.startWindowTracking();
  assert.equal(tracks, 1);
  assert.deepEqual([...clock.timers.values()].map(timer => timer.delay).sort((a, b) => a - b), [500, 3000]);

  await clock.runNext(500);
  assert.equal(tracks, 2);
  lockActive = false;
  await clock.runNext(500);
  assert.equal(tracks, 2);
  assert.equal(inactive, 1);
  assert.deepEqual([...clock.timers.values()].map(timer => timer.delay), [3000]);

  scheduler.stop();
  assert.equal(clock.timers.size, 0);
  assert.equal(detections, 1);
});

test('stopping the scheduler clears both detection and lock tracking timers', async () => {
  const clock = createFakeTimers();
  let lockActive = true;
  const scheduler = createBrowserPollScheduler({
    detectBrowsers: () => {},
    trackWindows: () => {},
    isLockActive: () => lockActive,
    setTimeoutFn: clock.setTimeout,
    clearTimeoutFn: clock.clearTimeout,
  });

  scheduler.start();
  await Promise.resolve();
  await Promise.resolve();
  scheduler.startWindowTracking();
  assert.equal(clock.timers.size, 2);
  scheduler.stop();
  lockActive = false;
  assert.equal(clock.timers.size, 0);
});
