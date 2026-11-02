const BROWSER_PROCESS_GROUPS = Object.freeze({
  chrome: ['chrome.exe'],
  brave: ['brave.exe'],
  edge: ['msedge.exe'],
  firefox: ['firefox.exe'],
  opera: ['opera.exe', 'opera_gx.exe'],
});

const PROCESS_NAMES = new Map(Object.entries(BROWSER_PROCESS_GROUPS)
  .flatMap(([family, names]) => names.map(name => [name, family])));

function familyFromTitle(title) {
  const normalizedTitle = title.toLowerCase();
  if (normalizedTitle.endsWith(' - google chrome')) return 'chrome';
  if (normalizedTitle.endsWith(' - brave')) return 'brave';
  if (normalizedTitle.endsWith(' - microsoft edge')) return 'edge';
  return null;
}

function createWindowsBrowserWatcher(koffiModule = require('koffi')) {
  if (process.platform !== 'win32') throw new Error('El vigilante de ventanas solo está disponible en Windows.');

  const koffi = koffiModule;
  const kernel32 = koffi.load('kernel32.dll');
  const user32 = koffi.load('user32.dll');
  const PROCESSENTRY32W = koffi.struct('Locky_PROCESSENTRY32W', {
    dwSize: 'uint32_t',
    cntUsage: 'uint32_t',
    th32ProcessID: 'uint32_t',
    th32DefaultHeapID: 'uintptr_t',
    th32ModuleID: 'uint32_t',
    cntThreads: 'uint32_t',
    th32ParentProcessID: 'uint32_t',
    pcPriClassBase: 'int32_t',
    dwFlags: 'uint32_t',
    szExeFile: koffi.array('char16_t', 260, 'String'),
  });
  const RECT = koffi.struct('Locky_RECT', {
    left: 'int32_t',
    top: 'int32_t',
    right: 'int32_t',
    bottom: 'int32_t',
  });

  const createToolhelp32Snapshot = kernel32.func('void *__stdcall CreateToolhelp32Snapshot(uint32_t dwFlags, uint32_t th32ProcessID)');
  const process32First = kernel32.func('int __stdcall Process32FirstW(void *hSnapshot, _Inout_ Locky_PROCESSENTRY32W *lppe)');
  const process32Next = kernel32.func('int __stdcall Process32NextW(void *hSnapshot, _Inout_ Locky_PROCESSENTRY32W *lppe)');
  const closeHandle = kernel32.func('int __stdcall CloseHandle(void *hObject)');
  const getForegroundWindow = user32.func('void *__stdcall GetForegroundWindow(void)');
  const EnumWindowsProc = koffi.proto('int __stdcall EnumWindowsProc(void *hWnd, intptr_t lParam)');
  const enumWindows = user32.func('EnumWindows', 'int', [koffi.pointer(EnumWindowsProc), 'intptr_t']);
  const getWindowThreadProcessId = user32.func('uint32_t __stdcall GetWindowThreadProcessId(void *hWnd, _Out_ uint32_t *lpdwProcessId)');
  const isWindowVisible = user32.func('int __stdcall IsWindowVisible(void *hWnd)');
  const isIconic = user32.func('int __stdcall IsIconic(void *hWnd)');
  const getWindowRect = user32.func('int __stdcall GetWindowRect(void *hWnd, _Out_ Locky_RECT *lpRect)');
  const getWindowText = user32.func('int __stdcall GetWindowTextW(void *hWnd, _Out_ char16_t *lpString, int nMaxCount)');
  const getClassName = user32.func('int __stdcall GetClassNameW(void *hWnd, _Out_ char16_t *lpClassName, int nMaxCount)');
  const browserClass = 'Chrome_WidgetWin_1';
  const invalidHandle = BigInt.asUintN(64, -1n);
  let activeWindowScan = null;

  const enumWindowsCallback = (hwnd, _lParam) => {
    if (!activeWindowScan) return 1;
    const { processes, windows, foreground } = activeWindowScan;
    try {
      if (!isWindowVisible(hwnd) && !isIconic(hwnd)) return 1;
      const classBuffer = Buffer.alloc(128 * 2);
      const classLength = getClassName(hwnd, classBuffer, 128);
      if (classLength <= 0 || koffi.decode(classBuffer, 'char16_t', classLength) !== browserClass) return 1;

      const pid = [0];
      if (!getWindowThreadProcessId(hwnd, pid) || pid[0] === 0) return 1;
      const titleBuffer = Buffer.alloc(512 * 2);
      const titleLength = getWindowText(hwnd, titleBuffer, 512);
      const title = titleLength > 0 ? koffi.decode(titleBuffer, 'char16_t', titleLength) : '';
      const family = processes.get(pid[0]) ?? familyFromTitle(title);
      if (!family) return 1;

      const rect = {};
      if (!getWindowRect(hwnd, rect)) return 1;
      const width = Math.max(0, rect.right - rect.left);
      const height = Math.max(0, rect.bottom - rect.top);
      if (!width || !height) return 1;

      windows.push({
        id: hwnd.toString(16).toUpperCase(),
        family,
        x: rect.left,
        y: rect.top,
        width,
        height,
        visible: Boolean(isWindowVisible(hwnd)),
        minimized: Boolean(isIconic(hwnd)),
        foreground: hwnd === foreground,
        title,
      });
    } catch {
      // Una ventana puede cerrarse entre EnumWindows y las consultas de sus datos.
    }
    return 1;
  };

  function readProcesses() {
    const snapshot = createToolhelp32Snapshot(0x00000002, 0);
    if (snapshot === null || BigInt.asUintN(64, snapshot) === invalidHandle) {
      throw new Error('Windows no pudo crear la instantánea de procesos.');
    }
    const processes = new Map();
    const families = new Set();
    try {
      const entry = { dwSize: koffi.sizeof(PROCESSENTRY32W) };
      if (!process32First(snapshot, entry)) return { processes, families };
      do {
        const image = entry.szExeFile.toLowerCase();
        const family = PROCESS_NAMES.get(image);
        if (family) {
          processes.set(entry.th32ProcessID, family);
          families.add(family);
        }
        entry.dwSize = koffi.sizeof(PROCESSENTRY32W);
      } while (process32Next(snapshot, entry));
      return { processes, families };
    } finally {
      closeHandle(snapshot);
    }
  }

  function readWindows(processes) {
    const windows = [];
    activeWindowScan = { processes, windows, foreground: getForegroundWindow() };
    try {
      if (!enumWindows(enumWindowsCallback, 0)) throw new Error('Windows no pudo enumerar las ventanas.');
      return windows;
    } finally {
      activeWindowScan = null;
    }
  }

  return Object.freeze({
    snapshot() {
      const { processes, families } = readProcesses();
      const windows = readWindows(processes);
      for (const window of windows) families.add(window.family);
      return { families: [...families], windows };
    },
  });
}

module.exports = { createWindowsBrowserWatcher, familyFromTitle };
