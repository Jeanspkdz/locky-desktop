import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createDiagnosticLogger } = require('../../src/main/diagnostic-log.cjs');

test('browser watcher failures are written to a persistent diagnostic log', async t => {
  const directory = await fs.mkdtemp(path.join(process.cwd(), '.scratch', 'locky-diagnostics-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const logPath = path.join(directory, 'locky-diagnostics.log');
  const logger = createDiagnosticLogger(logPath, { now: () => new Date('2026-11-02T12:00:00.000Z') });

  logger.error('BROWSER_WATCHER_FAILURE', new Error('Koffi could not load.'));

  const log = await fs.readFile(logPath, 'utf8');
  assert.match(log, /2026-11-02T12:00:00\.000Z BROWSER_WATCHER_FAILURE: Error: Koffi could not load\./);
});

test('a diagnostic log write failure cannot stop browser monitoring', async t => {
  const directory = await fs.mkdtemp(path.join(process.cwd(), '.scratch', 'locky-diagnostics-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const blockedParent = path.join(directory, 'not-a-directory');
  await fs.writeFile(blockedParent, 'file');
  const logger = createDiagnosticLogger(path.join(blockedParent, 'locky.log'));

  assert.doesNotThrow(() => logger.error('BROWSER_WATCHER_FAILURE', new Error('Koffi unavailable')));
});
