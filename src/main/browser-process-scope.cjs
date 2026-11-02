const fs = require('node:fs');
const { PROTECTED_BROWSER_FAMILIES } = require('../domain/protected-browser-families.cjs');

function createBrowserProcessScopeReader({ testMode = false, filePath = null } = {}) {
  if (!testMode) return () => null;

  return () => {
    if (!filePath) return {};
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      return Object.fromEntries(PROTECTED_BROWSER_FAMILIES.flatMap(family => {
        const pids = parsed[family];
        if (!Array.isArray(pids)) return [];
        const validPids = [...new Set(pids.filter(pid => Number.isSafeInteger(pid) && pid > 0))];
        return validPids.length ? [[family, validPids]] : [];
      }));
    } catch {
      return {};
    }
  };
}

module.exports = { createBrowserProcessScopeReader };
