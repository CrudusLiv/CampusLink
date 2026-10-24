import { NextResponse } from 'next/server';
import { authenticate, fail, unauthorized } from '@/lib/sessions/api';
import { submitFeedback } from '@/lib/sessions/data';
import { feedbackSchema, fieldErrors } from '@/lib/sessions/schemas';

export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (!auth) return unauthorized();

  const input = feedbackSchema.safeParse(await req.json().catch(() => null));
  if (!input.success) return fail(400, 'validation', 'Please choose a star rating', fieldErrors(input.error));

  try {
    const result = await submitFeedback(auth.db, input.data);
    if (!result.ok) return fail(result.error.status, result.error.error, result.error.message);
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (e) {
    console.error('POST /api/sessions/feedback failed:', e instanceof Error ? e.message : e);
    return fail(500, 'unknown', 'We could not save your feedback. Please try again.');
  }
}
