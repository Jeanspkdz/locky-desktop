const WEB_PROTOCOLS = new Set(['http:', 'https:']);
export const MAX_DYNAMIC_BLOCK_RULES = 5_000;
export const MAX_PATH_BLOCK_RULES = 1_000;
export const DOMAIN_HOSTS_PER_DNR_RULE = 100;

export function assertRuleCapacity(existingRules, newRule) {
  return assertRuleSetCapacity([...existingRules, newRule]);
}

export function assertRuleSetCapacity(rules) {
  const domainCount = new Set(rules.filter(rule => rule.type === 'domain').map(rule => rule.host)).size;
  const pathCount = rules.filter(rule => rule.type === 'path').length;
  if (pathCount > MAX_PATH_BLOCK_RULES) {
    throw new RangeError(`El navegador admite como máximo ${MAX_PATH_BLOCK_RULES.toLocaleString('es-PE')} reglas de ruta.`);
  }
  const dynamicRuleCount = Math.ceil(domainCount / DOMAIN_HOSTS_PER_DNR_RULE) + pathCount;
  if (dynamicRuleCount > MAX_DYNAMIC_BLOCK_RULES) {
    throw new RangeError(`El navegador admite como máximo ${MAX_DYNAMIC_BLOCK_RULES.toLocaleString('es-PE')} reglas dinámicas; reduce la cantidad de dominios o rutas.`);
  }
  return dynamicRuleCount;
}

function parseWebUrl(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    throw new TypeError('Ingresa una URL http o https válida.');
  }
  if (!WEB_PROTOCOLS.has(url.protocol)) {
    throw new TypeError('Solo se aceptan URL http o https.');
  }
  return url;
}

function normalizePath(pathname) {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed || '/';
}

export function normalizeRule({ type, value, source = 'user' }) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError('Ingresa un dominio o URL.');
  }

  if (type === 'domain') {
    const host = value.trim().toLowerCase().replace(/^\.+/, '');
    if (/[/\s?#:@]/.test(host)) {
      throw new TypeError('Ingresa solo el dominio, sin ruta ni protocolo.');
    }
    const parsed = parseWebUrl(`https://${host}`);
    if (!parsed.hostname.includes('.') || parsed.hostname.startsWith('.') || parsed.hostname.endsWith('.')) {
      throw new TypeError('Ingresa un dominio válido.');
    }
    return Object.freeze({ type, host: parsed.hostname.toLowerCase(), path: '/', source });
  }

  if (type === 'path') {
    const parsed = parseWebUrl(value.trim());
    if (normalizePath(parsed.pathname) === '/') {
      throw new TypeError('La regla de ruta necesita una ruta después del dominio.');
    }
    return Object.freeze({
      type,
      host: parsed.hostname.toLowerCase(),
      path: normalizePath(parsed.pathname),
      source,
    });
  }

  throw new TypeError('Elige una regla de dominio o de ruta.');
}

export function matchesRule(input, rule) {
  const url = parseWebUrl(input);
  const host = url.hostname.toLowerCase();
  const ruleHost = rule.host.toLowerCase();
  const hostMatches = host === ruleHost || (rule.type === 'domain' && host.endsWith(`.${ruleHost}`));
  if (!hostMatches) return false;
  if (rule.type === 'domain') return true;

  const path = normalizePath(url.pathname);
  const rulePath = normalizePath(rule.path || '/');
  return path === rulePath || path.startsWith(`${rulePath}/`);
}

export function findMatchingRule(input, rules) {
  return rules.find(rule => matchesRule(input, rule)) ?? null;
}
