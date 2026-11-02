const BROWSER_PROCESS_GROUPS = Object.freeze({
  chrome: ['chrome.exe'],
  brave: ['brave.exe'],
  edge: ['msedge.exe'],
  firefox: ['firefox.exe'],
  opera: ['opera.exe', 'opera_gx.exe'],
});

const PROTECTED_FAMILIES = Object.freeze(['chrome', 'brave', 'edge']);

function createBrowserProcessControl({ execute, getProcessIds }) {
  if (typeof execute !== 'function') throw new TypeError('A process executor is required.');

  async function closeFamily(family) {
    if (getProcessIds) {
      const processIds = getProcessIds(family) ?? [];
      for (const processId of new Set(processIds)) {
        if (!Number.isSafeInteger(processId) || processId <= 0) continue;
        await execute('taskkill.exe', ['/PID', String(processId), '/T', '/F'], { windowsHide: true }).catch(() => {});
      }
      return;
    }

    for (const executable of BROWSER_PROCESS_GROUPS[family] ?? []) {
      await execute('taskkill.exe', ['/IM', executable, '/T', '/F'], { windowsHide: true }).catch(() => {});
    }
  }

  async function closeProtectedBrowsers() {
    for (const family of PROTECTED_FAMILIES) await closeFamily(family);
  }

  return {
    closeFamily,
    closeProtectedBrowsers,
    families: Object.freeze(Object.keys(BROWSER_PROCESS_GROUPS)),
    hasFamily: family => Object.hasOwn(BROWSER_PROCESS_GROUPS, family),
  };
}

module.exports = { createBrowserProcessControl };
