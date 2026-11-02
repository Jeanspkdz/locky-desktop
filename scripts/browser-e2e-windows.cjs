const koffi = require('koffi');

if (process.platform !== 'win32') throw new Error('Browser lifecycle smoke requires Windows.');

const user32 = koffi.load('user32.dll');
const RECT = koffi.struct('Locky_E2E_RECT', {
  left: 'int32_t',
  top: 'int32_t',
  right: 'int32_t',
  bottom: 'int32_t',
});
const EnumWindowsProc = koffi.proto('int __stdcall Locky_E2E_EnumWindowsProc(void *hWnd, intptr_t lParam)');
const enumWindows = user32.func('EnumWindows', 'int', [koffi.pointer(EnumWindowsProc), 'intptr_t']);
const getWindowThreadProcessId = user32.func('uint32_t __stdcall GetWindowThreadProcessId(void *hWnd, _Out_ uint32_t *lpdwProcessId)');
const isWindowVisible = user32.func('int __stdcall IsWindowVisible(void *hWnd)');
const isIconic = user32.func('int __stdcall IsIconic(void *hWnd)');
const getWindowRect = user32.func('int __stdcall GetWindowRect(void *hWnd, _Out_ Locky_E2E_RECT *lpRect)');
const getWindowText = user32.func('int __stdcall GetWindowTextW(void *hWnd, _Out_ char16_t *lpString, int nMaxCount)');
const getClassName = user32.func('int __stdcall GetClassNameW(void *hWnd, _Out_ char16_t *lpClassName, int nMaxCount)');
const getWindowOwner = user32.func('void *__stdcall GetWindow(void *hWnd, uint32_t uCmd)');

function snapshotWindows() {
  const windows = [];
  const callback = (hwnd, _parameter) => {
    try {
      const processId = [0];
      if (!getWindowThreadProcessId(hwnd, processId) || !processId[0]) return 1;
      const classBuffer = Buffer.alloc(256);
      const classLength = getClassName(hwnd, classBuffer, 128);
      const titleBuffer = Buffer.alloc(1024);
      const titleLength = getWindowText(hwnd, titleBuffer, 512);
      const rect = {};
      if (!getWindowRect(hwnd, rect)) return 1;
      const owner = getWindowOwner(hwnd, 4);
      windows.push({
        id: hwnd.toString(16).toUpperCase(),
        processId: processId[0],
        ownerId: owner ? owner.toString(16).toUpperCase() : null,
        className: classLength > 0 ? koffi.decode(classBuffer, 'char16_t', classLength) : '',
        title: titleLength > 0 ? koffi.decode(titleBuffer, 'char16_t', titleLength) : '',
        x: rect.left,
        y: rect.top,
        width: Math.max(0, rect.right - rect.left),
        height: Math.max(0, rect.bottom - rect.top),
        visible: Boolean(isWindowVisible(hwnd)),
        minimized: Boolean(isIconic(hwnd)),
      });
    } catch {
      // Window handles can disappear while the desktop is being enumerated.
    }
    return 1;
  };
  if (!enumWindows(callback, 0)) throw new Error('Windows could not enumerate top-level windows.');
  return windows;
}

module.exports = { snapshotWindows };
