import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';

const require = createRequire(import.meta.url);
const { createWindowsBrowserWatcher } = require('../../src/main/windows-browser-watcher.cjs');

function createKoffiFixture({ processes = [], windows = [], foreground = 1n, snapshotHandle = 1n } = {}) {
  const processSnapshot = { index: -1 };
  const findWindow = handle => windows.find(window => BigInt(window.id) === handle);
  const writeWideString = (buffer, value) => {
    buffer.fill(0);
    for (let index = 0; index < value.length; index += 1) buffer.writeUInt16LE(value.charCodeAt(index), index * 2);
    return value.length;
  };
  const kernelFunctions = {
    CreateToolhelp32Snapshot: () => snapshotHandle,
    Process32FirstW: (_handle, entry) => {
      processSnapshot.index = 0;
      if (!processes[0]) return 0;
      Object.assign(entry, processes[0]);
      return 1;
    },
    Process32NextW: (_handle, entry) => {
      processSnapshot.index += 1;
      const process = processes[processSnapshot.index];
      if (!process) return 0;
      Object.assign(entry, process);
      return 1;
    },
    CloseHandle: () => 1,
  };
  const userFunctions = {
    GetForegroundWindow: () => foreground,
    EnumWindows: callback => {
      for (const window of windows) callback(BigInt(window.id), 0);
      return 1;
    },
    GetWindowThreadProcessId: (handle, output) => {
      output[0] = findWindow(handle)?.processId ?? 0;
      return output[0] ? 1 : 0;
    },
    IsWindowVisible: handle => Number(Boolean(findWindow(handle)?.visible)),
    IsIconic: handle => Number(Boolean(findWindow(handle)?.minimized)),
    GetWindowRect: (handle, output) => {
      const rect = findWindow(handle)?.rect;
      if (!rect) return 0;
      Object.assign(output, rect);
      return 1;
    },
    GetWindowTextW: (handle, buffer) => writeWideString(buffer, findWindow(handle)?.title ?? ''),
    GetClassNameW: (handle, buffer) => writeWideString(buffer, findWindow(handle)?.className ?? ''),
  };
  const library = functions => ({
    func(...signature) {
      const declaration = signature[0];
      const name = declaration === 'EnumWindows' ? declaration : declaration.match(/([A-Za-z0-9_]+)\s*\(/)?.[1];
      const fn = functions[name];
      if (!fn) throw new Error(`Unexpected Win32 binding ${name}`);
      return fn;
    },
  });

  return {
    koffi: {
      load(name) {
        if (name === 'kernel32.dll') return library(kernelFunctions);
        if (name === 'user32.dll') return library(userFunctions);
        throw new Error(`Unexpected Win32 library ${name}`);
      },
      struct: name => name,
      array: (_type, _length, name) => name,
      proto: name => name,
      pointer: name => name,
      sizeof: () => 1,
      decode: (buffer, _type, length) => buffer.toString('utf16le', 0, length * 2),
    },
    windows,
    processes,
  };
}

function process(pid) {
  return { th32ProcessID: pid, szExeFile: 'brave.exe' };
}

function browserWindow({ id, processId, visible = true, minimized = false, title = 'New Tab - Brave' }) {
  return {
    id,
    processId,
    visible,
    minimized,
    title,
    className: 'Chrome_WidgetWin_1',
    rect: { left: 10, top: 20, right: 1010, bottom: 720 },
  };
}

test('detects Brave that was already running when the supervisor starts', () => {
  const fixture = createKoffiFixture({
    processes: [process(10)],
    windows: [browserWindow({ id: 1, processId: 10 })],
  });
  const watcher = createWindowsBrowserWatcher(fixture.koffi);
  const startedAt = performance.now();
  const snapshot = watcher.snapshot();

  assert.deepEqual(snapshot.families, ['brave']);
  assert.equal(snapshot.windows[0].processId, 10);
  assert.ok(performance.now() - startedAt < 1000, 'an already-open Brave window is detected immediately');
});

test('maps Brave windows to their owning PID when child processes have no window', () => {
  const fixture = createKoffiFixture({
    processes: [process(20), process(21), process(22)],
    windows: [browserWindow({ id: 2, processId: 20 }), browserWindow({ id: 3, processId: 22, title: 'Second window - Brave' })],
    foreground: 3n,
  });
  const snapshot = createWindowsBrowserWatcher(fixture.koffi).snapshot();

  assert.deepEqual(snapshot.families, ['brave']);
  assert.deepEqual(snapshot.windows.map(window => window.processId), [20, 22]);
  assert.deepEqual(snapshot.windows.map(window => window.foreground), [false, true]);
  assert.equal(snapshot.windows.some(window => window.processId === 21), false);
});

test('detects a Brave window opened after a watcher has already started', () => {
  const fixture = createKoffiFixture({ processes: [], windows: [] });
  const watcher = createWindowsBrowserWatcher(fixture.koffi);
  assert.deepEqual(watcher.snapshot(), { families: [], windows: [] });

  fixture.processes.push(process(40));
  fixture.windows.push(browserWindow({ id: 4, processId: 40 }));
  const snapshot = watcher.snapshot();

  assert.deepEqual(snapshot.families, ['brave']);
  assert.equal(snapshot.windows[0].processId, 40);
});

test('detects Brave by its window title when its process cannot be queried', () => {
  const fixture = createKoffiFixture({
    processes: [],
    windows: [browserWindow({ id: 5, processId: 50, title: 'New Tab - Brave' })],
  });

  const snapshot = createWindowsBrowserWatcher(fixture.koffi).snapshot();

  assert.deepEqual(snapshot.families, ['brave']);
  assert.equal(snapshot.windows[0].processId, 50);
});
