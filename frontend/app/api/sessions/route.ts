import { NextResponse } from 'next/server';
import { authenticate, fail, unauthorized } from '@/lib/sessions/api';
import { createSession, listSessions } from '@/lib/sessions/data';
import { fieldErrors, listQuerySchema, scheduleSchema } from '@/lib/sessions/schemas';
import { getAcceptedRequest } from '@/lib/sessions/wrappers';

// Flow for every handler: validate input (Zod) -> check the caller -> query as the caller (RLS applies).
// PATCH (reschedule / cancel / complete) lands here in Iteration 2.

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
  } catch {
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
