// Vercel function: GET /api/markets?vs=usd|idr → live prices (cached; also cached at Vercel's edge for 60 s)
import { getMarkets } from '../lib/markets.js';
export async function GET(request) {
  try {
    const m = await getMarkets(new URL(request.url).searchParams.get('vs') || 'usd');
    return Response.json({ fetchedAt: new Date(m.at).toISOString(), source: 'CoinGecko', coins: m.coins },
      { headers: { 'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=120' } });
  } catch (e) {
    console.error('[markets]', e.message);
    return Response.json({ error: 'markets_unavailable' }, { status: 502 });
  }
}
