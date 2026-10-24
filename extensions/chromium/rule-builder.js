function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const ruleIndexCache = new WeakMap();

function indexRules(rules) {
  let index = ruleIndexCache.get(rules);
  if (index) return index;
  const domainRules = new Map();
  const pathRules = new Map();
  for (const rule of rules) {
    if (rule.type === 'domain') {
      if (!domainRules.has(rule.host)) domainRules.set(rule.host, rule);
      continue;
    }
    const rulesForHost = pathRules.get(rule.host) ?? [];
    rulesForHost.push(rule);
    pathRules.set(rule.host, rulesForHost);
  }
  index = { domainRules, pathRules };
  ruleIndexCache.set(rules, index);
  return index;
}

function toBrowserRules(rules) {
  const pathRules = rules.filter(rule => rule.type === 'path');
  if (pathRules.length > 1000) throw new Error('El navegador admite como máximo 1,000 reglas por ruta.');
  const domainHosts = [...new Set(rules.filter(rule => rule.type === 'domain').map(rule => rule.host.toLowerCase()))];
  const groupedDomains = [];
  for (let offset = 0; offset < domainHosts.length; offset += 100) {
    groupedDomains.push(domainHosts.slice(offset, offset + 100));
  }
  const browserRules = groupedDomains.map((requestDomains, index) => ({
    id: index + 1,
    priority: 1,
    action: { type: 'block' },
    condition: { requestDomains, resourceTypes: ['main_frame'] },
  }));
  for (const rule of pathRules) {
    const host = rule.host.toLowerCase();
    browserRules.push({
      id: browserRules.length + 1,
      priority: 2,
      action: { type: 'block' },
      condition: { regexFilter: `^https?://${escapeRegex(host)}${escapeRegex(rule.path)}(?:/|[?#]|$)`, resourceTypes: ['main_frame'] },
    });
  }
  if (browserRules.length > 5000) throw new Error('El navegador admite como máximo 5,000 reglas dinámicas.');
  return browserRules;
}

function findBrowserRule(input, rules) {
  let url;
  try { url = new URL(input); } catch { return null; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  const host = url.hostname.toLowerCase();
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  const index = indexRules(rules);
  let candidate = host;
  while (candidate.includes('.')) {
    const matchedDomain = index.domainRules.get(candidate);
    if (matchedDomain) return matchedDomain;
    candidate = candidate.slice(candidate.indexOf('.') + 1);
  }
  return (index.pathRules.get(host) ?? []).find(rule => pathname === rule.path || pathname.startsWith(`${rule.path}/`)) ?? null;
}

globalThis.LockyRules = { findBrowserRule, toBrowserRules };
