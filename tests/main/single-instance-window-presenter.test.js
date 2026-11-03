import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createSingleInstanceWindowPresenter } = require('../../src/main/single-instance-window-presenter.cjs');

test('a second-instance request waits until the initial settings window exists', () => {
  const shown = [];
  const presenter = createSingleInstanceWindowPresenter(() => shown.push('show'));

  presenter.request();
  assert.deepEqual(shown, []);

  presenter.markReady();
  assert.deepEqual(shown, ['show']);
});

test('multiple requests during startup reuse the one initialized settings window', () => {
  const shown = [];
  const presenter = createSingleInstanceWindowPresenter(() => shown.push('show'));

  presenter.request();
  presenter.request();
  presenter.request();
  presenter.markReady();

  assert.deepEqual(shown, ['show']);
});

test('requests after startup show the existing settings window immediately', () => {
  const shown = [];
  const presenter = createSingleInstanceWindowPresenter(() => shown.push('show'));

  presenter.markReady();
  presenter.request();
  presenter.request();

  assert.deepEqual(shown, ['show', 'show']);
});
