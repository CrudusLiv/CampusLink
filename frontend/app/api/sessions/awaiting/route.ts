import { NextResponse } from 'next/server';
import { authenticate, fail, unauthorized } from '@/lib/sessions/api';
import { listAwaitingRequests } from '@/lib/sessions/data';

// GET /api/sessions/awaiting  ->  { requests: AwaitingRequest[] }
// The caller's accepted support requests that still need a session time.
export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (!auth) return unauthorized();
  try {
    return NextResponse.json({ requests: await listAwaitingRequests(auth.db, auth.me.id) });
  } catch (e) {
    console.error('GET /api/sessions/awaiting failed:', e instanceof Error ? e.message : e); // shows in Vercel > Logs
    return fail(500, 'unknown', 'We could not load your accepted requests');
  }
}
