// Vercel function: POST /api/chat → streams ORBYTE AI's answer
import { handleChat } from '../lib/chat.js';
export async function POST(request) {
  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || request.headers.get('x-real-ip') || 'anon';
  return handleChat(request, ip);
}
