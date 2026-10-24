const SOURCES = Object.freeze({
  adult: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/porn/hosts',
  gambling: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/gambling/hosts',
});

async function downloadList(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000), redirect: 'follow' });
  if (!response.ok) throw new Error(`La lista remota respondió ${response.status}.`);
  return response.text();
}

async function getCandidates() {
  const { parseHostsList } = await import('../domain/hosts-list.js');
  const [adultText, gamblingText] = await Promise.all(Object.values(SOURCES).map(downloadList));
  const adult = parseHostsList(adultText);
  const gambling = parseHostsList(gamblingText);
  const categories = new Map();
  for (const domain of adult) categories.set(domain, new Set([...(categories.get(domain) ?? []), 'adult']));
  for (const domain of gambling) categories.set(domain, new Set([...(categories.get(domain) ?? []), 'gambling']));
  return {
    sources: SOURCES,
    checkedAt: Date.now(),
    candidates: [...categories].map(([domain, values]) => ({ domain, categories: [...values] })).sort((a, b) => a.domain.localeCompare(b.domain)),
  };
}

module.exports = { getCandidates, SOURCES };
