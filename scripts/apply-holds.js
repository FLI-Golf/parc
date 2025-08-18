#!/usr/bin/env node
// Small CLI to call the apply-holds API in development
// Usage: pnpm apply-holds:dev [--base http://localhost:5173]

const args = process.argv.slice(2);
const idx = args.indexOf('--base');
const base = idx >= 0 && args[idx + 1] ? args[idx + 1] : (process.env.APP_BASE_URL || 'http://localhost:5173');

const url = new URL('/api/reservations/apply-holds', base);
url.searchParams.set('debug', '1');

(async () => {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error('Request failed', res.status, res.statusText);
      process.exitCode = 1;
      const text = await res.text().catch(() => '');
      if (text) console.error(text);
      return;
    }
    const json = await res.json();
    console.log(JSON.stringify(json, null, 2));
  } catch (e) {
    console.error('Error calling apply-holds:', e?.message || e);
    process.exitCode = 1;
  }
})();
