import { NextResponse } from 'next/server';
import { authenticate, fail, unauthorized } from '@/lib/sessions/api';
import { completeSession, createSession, listSessions } from '@/lib/sessions/data';
import { completeSessionSchema, fieldErrors, listQuerySchema, scheduleSchema } from '@/lib/sessions/schemas';
import { getAcceptedRequest } from '@/lib/sessions/wrappers';

// Flow for every handler: validate input (Zod) -> check the caller -> query as the caller (RLS applies).

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (!auth) return unauthorized();

  const params = new URL(req.url).searchParams;
  const query = listQuerySchema.safeParse({
    status: params.get('status') ?? undefined,
    upcoming: params.get('upcoming') ?? undefined,
  });
  if (!query.success) return fail(400, 'validation', 'Invalid filter', fieldErrors(query.error));

  try {
    return NextResponse.json({ sessions: await listSessions(auth.db, auth.me.id, query.data) });
  } catch (e) {
    console.error('GET /api/sessions failed:', e instanceof Error ? e.message : e); // shows in Vercel > Logs
    return fail(500, 'unknown', 'We could not load your support sessions');
  }
}

export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (!auth) return unauthorized();

  const body = await req.json().catch(() => null);
  const input = scheduleSchema.safeParse(body);
  if (!input.success) return fail(400, 'validation', 'Please check the highlighted fields', fieldErrors(input.error));

  const context = await getAcceptedRequest(auth.db, input.data.requestId);
  if (!context) return fail(404, 'not_found', 'Support request not found, or it has not been accepted yet');
  if (auth.me.id !== context.requester.id && auth.me.id !== context.volunteer.id) {
    return fail(403, 'forbidden', 'You can only schedule your own support requests');
  }

  const result = await createSession(auth.db, auth.me.id, input.data, context);
  if (!result.ok) return fail(result.error.status, result.error.error, result.error.message);
  return NextResponse.json({ session: result.session }, { status: 201 });
}

export async function PATCH(req: Request) {
  const auth = await authenticate(req);
  if (!auth) return unauthorized();

  const body = await req.json().catch(() => null);
  const input = completeSessionSchema.safeParse(body);
  if (!input.success) return fail(400, 'validation', 'Please provide a valid session', fieldErrors(input.error));

  try {
    const result = await completeSession(auth.db, input.data.sessionId);
    if (!result.ok) return fail(result.error.status, result.error.error, result.error.message);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('PATCH /api/sessions failed:', e instanceof Error ? e.message : e);
    return fail(500, 'unknown', 'We could not complete this session. Please try again.');
  }
}
