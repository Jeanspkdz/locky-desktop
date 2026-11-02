export function getProtectionStatus(state) {
  const ruleCount = Array.isArray(state?.rules) ? state.rules.length : 0;
  if (ruleCount === 0) return 'Sin reglas bloqueantes';
  const ruleLabel = `${ruleCount} ${ruleCount === 1 ? 'regla' : 'reglas'}`;

  const health = Object.values(state?.browserHealth ?? {});
  if (health.some(browser => browser.status === 'repair')) {
    return `${ruleLabel} · integración por reparar`;
  }
  if (health.some(browser => browser.status === 'checking')) {
    return `${ruleLabel} · comprobando integración`;
  }
  return `${ruleLabel} ${ruleCount === 1 ? 'guardada' : 'guardadas'}`;
}
