export const VERIFICATION_PERIOD_MS = 10 * 60 * 1000;
export const DESKTOP_LOCK_PERIOD_MS = 7 * 60 * 1000;

export function addPendingRule(state, rule, now) {
  return {
    ...state,
    pendingRules: [
      ...state.pendingRules,
      { ...rule, status: 'pending', createdAt: now, consolidatesAt: now + VERIFICATION_PERIOD_MS },
    ],
  };
}

export function cancelPendingRule(state, ruleId) {
  return {
    ...state,
    pendingRules: state.pendingRules.filter(rule => rule.id !== ruleId),
  };
}

export function consolidateExpiredRules(state, now) {
  const expired = state.pendingRules.filter(rule => rule.consolidatesAt <= now);
  if (expired.length === 0) return state;
  const existingIds = new Set(state.rules.map(rule => rule.id));
  return {
    rules: [...state.rules, ...expired.filter(rule => !existingIds.has(rule.id)).map(({ status, createdAt, consolidatesAt, ...rule }) => rule)],
    pendingRules: state.pendingRules.filter(rule => rule.consolidatesAt > now),
  };
}

export function startDesktopLock(current, now, periodMs = DESKTOP_LOCK_PERIOD_MS) {
  if (current && current.endsAt > now) return current;
  return { startedAt: now, endsAt: now + periodMs };
}

export function remainingLockMs(lock, now) {
  return Math.max(0, (lock?.endsAt ?? now) - now);
}
