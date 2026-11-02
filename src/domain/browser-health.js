import protectedBrowserConfig from './protected-browser-families.cjs';

export const BROWSER_PROCESS_GROUPS = protectedBrowserConfig.BROWSER_PROCESS_GROUPS;
export const PROTECTED_BROWSER_FAMILIES = protectedBrowserConfig.PROTECTED_BROWSER_FAMILIES;

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
