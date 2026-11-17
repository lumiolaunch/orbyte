// Shared chat logic: validation, rate limiting and streaming from the Claude API.
import { systemPrompt } from './markets.js';

const LIMIT = Number(process.env.RATE_LIMIT) || 20;
const WINDOW = (Number(process.env.RATE_WINDOW_MIN) || 10) * 60_000;
const hits = new Map();
export function limited(ip) {
  const now = Date.now(), h = hits.get(ip);
  if (hits.size > 5000) for (const [k, v] of hits) if (now > v.reset) hits.delete(k);
  if (!h || now > h.reset) { hits.set(ip, { n: 1, reset: now + WINDOW }); return false; }
  h.n++; return h.n > LIMIT;
}

export function cleanMessages(input) {
  if (!Array.isArray(input)) return null;
  const msgs = input.slice(-12).map(m => ({
    role: m && m.role === 'assistant' ? 'assistant' : 'user',
    content: typeof m?.content === 'string' ? m.content.trim().slice(0, 1000) : '',
  })).filter(m => m.content);
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  const out = [];
  for (const m of msgs) { if (out.length && out[out.length - 1].role === m.role) out[out.length - 1] = m; else out.push(m); }
  if (!out.length || out[out.length - 1].role !== 'user') return null;
  return out;
}

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// Web-standard handler: Request in, streamed plain-text Response out
export async function handleChat(request, ip) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return json({ error: 'not_configured' }, 503);
  if (limited(ip || 'anon')) return json({ error: 'rate_limited' }, 429);

  const raw = await request.text();
  if (raw.length > 20_000) return json({ error: 'too_large' }, 413);
  let messages; try { messages = cleanMessages(JSON.parse(raw).messages); } catch { messages = null; }
  if (!messages) return json({ error: 'bad_request' }, 400);

  const base = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '');
  let upstream;
  try {
    upstream = await fetch(`${base}/v1/messages`, {
      method: 'POST', signal: request.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5', max_tokens: Number(process.env.MAX_TOKENS) || 400,
        system: await systemPrompt(), messages, stream: true }),
    });
  } catch (e) { console.error('[chat] network error:', e.message); return json({ error: 'upstream_unreachable' }, 502); }
  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '');
    console.error(`[chat] Claude API ${upstream.status}: ${detail.slice(0, 300)}`);
    return json({ error: upstream.status === 429 ? 'rate_limited' : 'upstream_error' }, upstream.status === 429 ? 429 : 502);
  }

  const reader = upstream.body.getReader(), dec = new TextDecoder(), enc = new TextEncoder();
  let buf = '';
  const stream = new ReadableStream({
    async pull(controller) {
      try {
        const { value, done } = await reader.read();
        if (done) return controller.close();
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
          if (!line.startsWith('data:')) continue;
          let ev; try { ev = JSON.parse(line.slice(5)); } catch { continue; }
          if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') controller.enqueue(enc.encode(ev.delta.text));
          else if (ev.type === 'error') console.error('[chat] stream error:', ev.error?.message);
        }
      } catch (e) { console.error('[chat] stream interrupted:', e.message); controller.close(); }
    },
    cancel() { reader.cancel().catch(() => {}); }, // visitor closed the chat → stop the upstream request
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' } });
}
