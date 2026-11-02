export const BROWSER_PROCESS_GROUPS = Object.freeze({
  chrome: ['chrome.exe'],
  brave: ['brave.exe'],
  edge: ['msedge.exe'],
  firefox: ['firefox.exe'],
  opera: ['opera.exe', 'opera_gx.exe'],
});

export const BROWSER_STARTUP_GRACE_MS = 15_000;
export const BROWSER_HEARTBEAT_TIMEOUT_MS = 60_000;

export function shouldEnforceBrowserIntegration(enabled, rules) {
  return enabled && rules.length > 0;
}

export function integrationFailureReason({ startedAt, lastHealthyAt }, now) {
  if (lastHealthyAt !== null && lastHealthyAt !== undefined && now - lastHealthyAt <= BROWSER_HEARTBEAT_TIMEOUT_MS) return null;
  if (now - startedAt < BROWSER_STARTUP_GRACE_MS) return null;
  return lastHealthyAt === null || lastHealthyAt === undefined ? 'missing' : 'stale';
}
