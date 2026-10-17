// Shared plumbing for the /api/sessions routes: who is calling, and a uniform error body.
import { NextResponse } from 'next/server';
import { bearerToken, dbForToken, type Db } from './server';
import { getCurrentUser, type CurrentUser } from './wrappers';

/** The caller's user-scoped client and profile, or null when the bearer token is missing or invalid. */
export async function authenticate(req: Request): Promise<{ db: Db; me: CurrentUser } | null> {
  const token = bearerToken(req);
  if (!token) return null;
  const db = dbForToken(token);
  const me = await getCurrentUser(db, token);
  return me ? { db, me } : null;
}

export const unauthorized = () => fail(401, 'unauthorized', 'Please sign in to continue');

export function fail(status: number, error: string, message: string, fields?: Record<string, string>) {
  return NextResponse.json({ error, message, ...(fields ? { fields } : {}) }, { status });
}
