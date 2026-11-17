// Vercel function: GET /api/markets → logos, market caps, sparklines and USD→fiat rates
// (cached 5 minutes here and at Vercel's edge). Real-time prices are streamed in the browser.
import { getMarkets } from '../lib/markets.js';
export async function GET() {
  try {
    const m = await getMarkets();
    return Response.json({ fetchedAt: new Date(m.at).toISOString(), source: 'CoinGecko', rates: m.rates, idr: m.rates?.idr ?? null, coins: m.coins },
      { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600' } });
  } catch (e) {
    console.error('[markets]', e.message);
    return Response.json({ error: 'markets_unavailable' }, { status: 502 });
  }
}
