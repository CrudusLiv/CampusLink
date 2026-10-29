import { NextResponse } from 'next/server';
import { authenticate, fail, unauthorized } from '@/lib/sessions/api';
import { setJoinDetails } from '@/lib/sessions/data';
import { fieldErrors, joinDetailsSchema } from '@/lib/sessions/schemas';

export async function PATCH(req: Request) {
  const auth = await authenticate(req);
  if (!auth) return unauthorized();

  const input = joinDetailsSchema.safeParse(await req.json().catch(() => null));
  if (!input.success) return fail(400, 'validation', 'Please check the details and try again', fieldErrors(input.error));

  try {
    const result = await setJoinDetails(auth.db, input.data.sessionId, input.data.details, input.data.saveAsDefault);
    if (!result.ok) return fail(result.error.status, result.error.error, result.error.message);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('PATCH /api/sessions/join-details failed:', e instanceof Error ? e.message : e);
    return fail(500, 'unknown', 'We could not save this. Please try again.');
  }
}
