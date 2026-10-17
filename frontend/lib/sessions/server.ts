// Server-side helpers for the sessions API. Every query runs as the SIGNED-IN USER (their JWT), so
// row-level security applies. The service-role key is never used here.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Participant } from './types';

export type Db = SupabaseClient;

export function bearerToken(req: Request): string | null {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get('authorization') ?? '');
  return m ? m[1].trim() : null;
}

export function dbForToken(token: string): Db {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Name + photo only (NFR8): never email, student ID or contact number. */
export async function loadParticipants(db: Db, ids: string[]): Promise<Map<string, Participant>> {
  const { data } = await db.from('users').select('user_id,name,photo_url').in('user_id', [...new Set(ids)]);
  return new Map((data ?? []).map((u) => [u.user_id, { id: u.user_id, name: u.name, photoUrl: u.photo_url ?? null }]));
}
