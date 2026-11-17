// Live crypto prices from CoinGecko, cached in memory for 60 seconds.
// Shared by server.js (local / any Node host) and the Vercel functions in /api.
import BRIEF from './brief.js';

export const COINS = ['bitcoin','ethereum','solana','binancecoin','ripple','cardano','dogecoin','avalanche-2','chainlink','the-open-network','tether','usd-coin'];
const CACHE_MS = 60_000;
const cache = new Map(); // vs → { at, coins } | { pending }

export async function getMarkets(vs = 'usd') {
  if (!['usd', 'idr'].includes(vs)) vs = 'usd';
  const c = cache.get(vs);
  if (c && c.coins && Date.now() - c.at < CACHE_MS) return c;
  if (c && c.pending) return c.pending;
  const base = (process.env.COINGECKO_BASE_URL || 'https://api.coingecko.com').replace(/\/$/, '');
  const key = process.env.COINGECKO_API_KEY;
  const url = `${base}/api/v3/coins/markets?vs_currency=${vs}&ids=${COINS.join(',')}&price_change_percentage=24h,7d&sparkline=true`;
  const pending = (async () => {
    const r = await fetch(url, { headers: key ? { 'x-cg-demo-api-key': key } : {}, signal: AbortSignal.timeout(10_000) });
    if (!r.ok) throw new Error(`CoinGecko ${r.status}`);
    const list = await r.json();
    const coins = list.map(x => ({
      id: x.id, symbol: String(x.symbol || '').toUpperCase(), name: x.name, price: x.current_price,
      ch24: x.price_change_percentage_24h_in_currency, ch7: x.price_change_percentage_7d_in_currency,
      cap: x.market_cap, vol: x.total_volume,
      spark: (x.sparkline_in_7d?.price || []).filter((_, i, a) => i % Math.max(1, Math.floor(a.length / 70)) === 0),
    }));
    const entry = { at: Date.now(), coins };
    cache.set(vs, entry);
    return entry;
  })();
  cache.set(vs, { ...(c || {}), pending });
  try { return await pending; }
  catch (e) { if (c && c.coins) { cache.set(vs, c); return c; } cache.delete(vs); throw e; }
}

export async function systemPrompt() {
  let data = 'Live market data: not available right now.';
  try {
    const m = await getMarkets('usd');
    const pct = v => v == null ? 'n/a' : (v > 0 ? '+' : '') + v.toFixed(2) + '%';
    data = `Live market data (USD, fetched ${new Date(m.at).toISOString().slice(0, 16).replace('T', ' ')} UTC, source CoinGecko):\n` +
      m.coins.map(c => `${c.name} (${c.symbol}): $${c.price}, 24h ${pct(c.ch24)}, 7d ${pct(c.ch7)}, market cap $${Math.round(c.cap || 0).toLocaleString('en-US')}`).join('\n');
  } catch (e) { console.error('[markets] for chat:', e.message); }
  return `${BRIEF}\n\n${data}`;
}
