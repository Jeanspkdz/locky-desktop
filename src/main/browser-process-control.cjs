const {
  BROWSER_PROCESS_GROUPS,
  PROTECTED_BROWSER_FAMILIES,
  selectProtectedBrowserFamilies,
} = require('../domain/protected-browser-families.cjs');

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
    for (const family of PROTECTED_BROWSER_FAMILIES) await closeFamily(family);
  }

  return {
    closeFamily,
    closeProtectedBrowsers,
    families: PROTECTED_BROWSER_FAMILIES,
    familiesForWatcherFailure: lastDetectedFamilies => selectProtectedBrowserFamilies(
      lastDetectedFamilies ?? [],
      PROTECTED_BROWSER_FAMILIES,
    ),
    hasFamily: family => Object.hasOwn(BROWSER_PROCESS_GROUPS, family),
  };
}

module.exports = { createBrowserProcessControl };
