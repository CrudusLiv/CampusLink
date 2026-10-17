import { NextResponse } from 'next/server';
import { authenticate, fail, unauthorized } from '@/lib/sessions/api';
import { getScheduleOptions } from '@/lib/sessions/data';

// GET /api/sessions/schedule-context?requestId=...  ->  { context, slots }
// Powers the Schedule Session screen: the accepted request plus the volunteer's free one-hour slots.
export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (!auth) return unauthorized();

  const requestId = new URL(req.url).searchParams.get('requestId') ?? '';
  const options = await getScheduleOptions(auth.db, requestId);
  if (!options) return fail(404, 'not_found', 'Support request not found, or it has not been accepted yet');
  return NextResponse.json(options);
}
