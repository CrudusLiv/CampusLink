// Shared plumbing for the /api/sessions routes: who is calling, and a uniform error body.
import { NextResponse } from 'next/server';
import { bearerToken, dbForToken, type Db } from './server';
import { getCurrentUser, type CurrentUser } from './wrappers';

/** The caller's user-scoped client and profile, or null when the bearer token is missing or invalid. */
export async function authenticate(req: Request): Promise<{ db: Db; me: CurrentUser } | null> {
  const token = bearerToken(req);
  if (!token) {
    console.warn('sessions API: 401, no Bearer token on the request'); // shows in Vercel > Logs
    return null;
  }
  const db = dbForToken(token);
  const me = await getCurrentUser(db, token);
  if (!me) console.warn('sessions API: 401, token did not resolve to a user with a profile row');
  return me ? { db, me } : null;
}

export const unauthorized = () => fail(401, 'unauthorized', 'Please sign in to continue');

export function fail(status: number, error: string, message: string, fields?: Record<string, string>) {
  return NextResponse.json({ error, message, ...(fields ? { fields } : {}) }, { status });
}
