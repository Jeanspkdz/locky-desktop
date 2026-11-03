import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const launcherSource = path.join(projectRoot, 'install/windows/native-host-launcher.cs');

function findCompiler() {
  const windowsRoot = process.env.WINDIR ?? 'C:\\Windows';
  return [
    path.join(windowsRoot, 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'),
    path.join(windowsRoot, 'Microsoft.NET/Framework/v4.0.30319/csc.exe'),
  ].find(candidate => {
    try { return existsSync(candidate); }
    catch { return false; }
  });
}

test('native host returns a bounded error when Locky never creates its pipe', { skip: process.platform !== 'win32' }, async t => {
  const compiler = findCompiler();
  if (!compiler) return t.skip('The Windows C# compiler used by setup:dev is unavailable.');

  const directory = await fs.mkdtemp(path.join(os.tmpdir(), `locky-native-pipe-${process.pid}-`));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const executable = path.join(directory, 'locky-native-host-test.exe');
  execFileSync(compiler, ['/nologo', '/target:exe', `/out:${executable}`, launcherSource], { windowsHide: true });

  const pipeName = `locky-test-missing-${process.pid}`;
  const message = Buffer.from(JSON.stringify({ id: 1, type: 'getState', offset: 0, limit: 0 }));
  const header = Buffer.alloc(4);
  header.writeUInt32LE(message.length);
  const startedAt = performance.now();
  const child = spawn(executable, ['chrome-extension://pgphggplmacpiglkndjhpaojeeoomfdn/'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
    env: {
      ...process.env,
      LOCKY_TEST_MODE: '1',
      LOCKY_TEST_APP_EXECUTABLE: path.join(process.env.WINDIR ?? 'C:\\Windows', 'System32/where.exe'),
      LOCKY_TEST_APP_ROOT: directory,
      LOCKY_TEST_PIPE_NAME: pipeName,
      LOCKY_NATIVE_HOST_TRACE: '1',
    },
  });
  t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill(); });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; });
  child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
  child.stdin.end(Buffer.concat([header, message]));

  const exit = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error('Native host exceeded the 14-second no-pipe response limit.'));
    }, 14_000);
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', (code, signal) => { clearTimeout(timeout); resolve({ code, signal }); });
  });

  assert.equal(exit.code, 1, stderr);
  assert.match(stderr, /Locky Desktop did not answer the browser request\./);
  assert.equal(stdout, '', 'the host does not emit a malformed success response when the pipe is absent');
  assert.ok(performance.now() - startedAt < 14_000);
});
