const BROWSER_PROCESS_GROUPS = Object.freeze({
  chrome: Object.freeze(['chrome.exe']),
  brave: Object.freeze(['brave.exe']),
  edge: Object.freeze(['msedge.exe']),
});

const PROTECTED_BROWSER_FAMILIES = Object.freeze(Object.keys(BROWSER_PROCESS_GROUPS));
const PROCESS_FAMILY_BY_IMAGE = new Map(Object.entries(BROWSER_PROCESS_GROUPS)
  .flatMap(([family, names]) => names.map(name => [name, family])));

function familyForProcessName(processName) {
  return PROCESS_FAMILY_BY_IMAGE.get(String(processName ?? '').toLowerCase()) ?? null;
}

function selectProtectedBrowserFamilies(...groups) {
  const candidates = new Set(groups.flat());
  return PROTECTED_BROWSER_FAMILIES.filter(family => candidates.has(family));
}

module.exports = {
  BROWSER_PROCESS_GROUPS,
  PROTECTED_BROWSER_FAMILIES,
  familyForProcessName,
  selectProtectedBrowserFamilies,
};
