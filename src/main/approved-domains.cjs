function applyApprovedDomains(state, candidates, checkedAt = Date.now()) {
  const domains = new Map();
  for (const candidate of [...(state.candidateList ?? []), ...candidates]) {
    if (typeof candidate?.domain !== 'string') continue;
    const domain = candidate.domain.trim().toLowerCase();
    if (!domain) continue;
    const previous = domains.get(domain);
    const categories = Array.isArray(candidate.categories) ? candidate.categories : [];
    domains.set(domain, {
      domain,
      categories: [...new Set([...(previous?.categories ?? []), ...categories])],
    });
  }

  const existingDomains = new Set(state.rules
    .filter(rule => rule.type === 'domain')
    .map(rule => String(rule.host ?? '').toLowerCase()));
  const additions = [...domains.values()]
    .filter(candidate => !existingDomains.has(candidate.domain))
    .map(({ domain, categories }) => ({
      id: `preset:${domain}`,
      type: 'domain',
      host: domain,
      path: '/',
      source: 'preset',
      categories,
    }));
  const approvedDomains = new Set(domains.keys());

  return {
    ...state,
    rules: additions.length ? [...state.rules, ...additions] : state.rules,
    pendingRules: state.pendingRules.filter(rule => rule.type !== 'domain' || !approvedDomains.has(String(rule.host ?? '').toLowerCase())),
    candidateList: [],
    candidateListApproved: true,
    candidateListApprovedAt: state.candidateListApprovedAt ?? checkedAt,
    candidateListCheckedAt: checkedAt,
  };
}

module.exports = { applyApprovedDomains };
