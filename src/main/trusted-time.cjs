const SOURCES = [
  'https://www.microsoft.com/',
  'https://www.cloudflare.com/',
  'https://www.google.com/generate_204',
];

async function fetchTrustedTime() {
  for (const url of SOURCES) {
    try {
      const response = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(4000) });
      const value = response.headers.get('date');
      const trustedUtcMs = value ? Date.parse(value) : NaN;
      if (Number.isFinite(trustedUtcMs)) return trustedUtcMs;
    } catch {}
  }
  return null;
}

module.exports = { fetchTrustedTime };
