import protectedBrowserConfig from './protected-browser-families.cjs';

export const BROWSER_PROCESS_GROUPS = protectedBrowserConfig.BROWSER_PROCESS_GROUPS;
export const PROTECTED_BROWSER_FAMILIES = protectedBrowserConfig.PROTECTED_BROWSER_FAMILIES;

export const BROWSER_STARTUP_GRACE_MS = 15_000;
export const BROWSER_HEARTBEAT_TIMEOUT_MS = 45_000;
export const BROWSER_RULE_SYNC_GRACE_MS = 45_000;

export function resetBrowserHealthForStartup() {
  return Object.fromEntries(PROTECTED_BROWSER_FAMILIES.map(family => [family, { status: 'idle' }]));
}

export function shouldEnforceBrowserIntegration(enabled, rules) {
  return enabled && rules.length > 0;
}

export function createBrowserRuntime(startedAt) {
  return { startedAt, lastHealthyAt: null, lastConnectedAt: null };
}

export function evaluateBrowserIntegration(runtime, now, enforcementEnabled, rules) {
  const failure = integrationFailureReason(runtime, now);
  return {
    failure,
    closeBrowser: failure !== null && shouldEnforceBrowserIntegration(enforcementEnabled, rules),
  };
}

export function integrationFailureReason({ startedAt, lastHealthyAt, lastConnectedAt }, now) {
  if (lastHealthyAt !== null && lastHealthyAt !== undefined) {
    if (now - lastHealthyAt <= BROWSER_HEARTBEAT_TIMEOUT_MS) return null;
    if (lastConnectedAt !== null && lastConnectedAt !== undefined && now - lastConnectedAt <= BROWSER_RULE_SYNC_GRACE_MS) return null;
    return 'stale';
  }
  if (lastConnectedAt !== null && lastConnectedAt !== undefined) {
    return now - lastConnectedAt <= BROWSER_RULE_SYNC_GRACE_MS ? null : 'stale';
  }
  if (now - startedAt < BROWSER_STARTUP_GRACE_MS) return null;
  return 'missing';
}
