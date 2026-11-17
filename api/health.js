// Vercel function: GET /api/health → tells the page whether ORBYTE AI is configured
export function GET() {
  const ok = !!process.env.ANTHROPIC_API_KEY;
  return Response.json({ ok }, { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
}
