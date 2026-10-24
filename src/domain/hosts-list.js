import { isIP } from 'node:net';

export function parseHostsList(contents) {
  const domains = new Set();
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.split('#', 1)[0].trim().toLowerCase();
    if (!line) continue;
    const parts = line.split(/\s+/);
    const host = parts.length > 1 && isIP(parts[0]) !== 0 ? parts[1] : parts[0];
    if (!host || host === 'localhost' || host.endsWith('.localhost') || isIP(host) !== 0) continue;
    try {
      const parsed = new URL(`https://${host}`);
      if (parsed.hostname === host && host.includes('.') && !host.endsWith('.')) domains.add(host);
    } catch {}
  }
  return [...domains].sort();
}
