// Market data from CoinGecko (logos, names, market cap, volume, 7-day sparkline, USD→fiat rates),
// cached for 5 minutes. Real-time prices (every second) come straight from Binance in the browser.
// Shared by server.js (local / any Node host) and the Vercel functions in /api.
import BRIEF from './brief.js';

export const COINS = ['bitcoin','ethereum','tether','binancecoin','solana','ripple','usd-coin','dogecoin','cardano','tron',
  'avalanche-2','the-open-network','chainlink','shiba-inu','polkadot','bitcoin-cash','litecoin','near','uniswap','sui',
  'aptos','internet-computer','ethereum-classic','stellar','pepe','render-token','arbitrum','optimism','cosmos','filecoin',
  'hedera-hashgraph','injective-protocol','aave','the-graph','polygon-ecosystem-token','fetch-ai','worldcoin-wld','sei-network','bonk','algorand'];
export const CURRENCIES = ['idr','eur','gbp','jpy','sgd','myr','thb','php','vnd','krw','cny','hkd','inr','aud','cad','chf','aed','sar','try','brl'];
const CACHE_MS = 5 * 60_000; // CoinGecko's free plan has a monthly call cap — keep this ≥ 5 minutes
let cache = null, pending = null;

const base = () => (process.env.COINGECKO_BASE_URL || 'https://api.coingecko.com').replace(/\/$/, '');
const headers = () => process.env.COINGECKO_API_KEY ? { 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY } : {};
async function cg(path) {
  const r = await fetch(base() + path, { headers: headers(), signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`CoinGecko ${r.status}`);
  return r.json();
}

export async function getMarkets() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache;
  if (pending) return pending;
  pending = (async () => {
    const [list, rate] = await Promise.all([
      cg(`/api/v3/coins/markets?vs_currency=usd&ids=${COINS.join(',')}&per_page=100&price_change_percentage=24h,7d&sparkline=true`),
      cg(`/api/v3/simple/price?ids=tether&vs_currencies=${CURRENCIES.join(',')}`).catch(() => null),
    ]);
    const coins = list.map(x => ({
      id: x.id, symbol: String(x.symbol || '').toUpperCase(), name: x.name, price: x.current_price,
      ch24: x.price_change_percentage_24h_in_currency, ch7: x.price_change_percentage_7d_in_currency,
      cap: x.market_cap, vol: x.total_volume, image: x.image,
      spark: (x.sparkline_in_7d?.price || []).filter((_, i, a) => i % Math.max(1, Math.floor(a.length / 70)) === 0),
    }));
    const usdt = coins.find(c => c.id === 'tether');
    // fiat rates per 1 USD (via USDT), e.g. { idr: 16750, eur: 0.92, ... }
    const rates = { ...(cache?.rates || {}) };
    if (rate?.tether && usdt?.price) for (const [k, v] of Object.entries(rate.tether)) if (v > 0) rates[k] = v / usdt.price;
    cache = { at: Date.now(), coins, rates };
    return cache;
  })();
  try { return await pending; }
  catch (e) { if (cache) return cache; throw e; } // serve the last good data if a refresh fails
  finally { pending = null; }
}

export async function systemPrompt() {
  let data = 'Live market data: not available right now.';
  try {
    const m = await getMarkets();
    const pct = v => v == null ? 'n/a' : (v > 0 ? '+' : '') + v.toFixed(2) + '%';
    data = `Market data (USD, fetched ${new Date(m.at).toISOString().slice(0, 16).replace('T', ' ')} UTC, source CoinGecko):\n` +
      m.coins.slice(0, 25).map(c => `${c.name} (${c.symbol}): $${c.price}, 24h ${pct(c.ch24)}, 7d ${pct(c.ch7)}, market cap $${Math.round(c.cap || 0).toLocaleString('en-US')}`).join('\n');
  } catch (e) { console.error('[markets] for chat:', e.message); }
  return `${BRIEF}\n\n${data}`;
}
