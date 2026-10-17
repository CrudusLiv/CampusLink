// The ONLY two places the sessions module depends on teammates' tables (Doreen: users/volunteer_profile,
// Darryl: support_request). If their schema changes, this is the file to touch.
import { loadParticipants, type Db } from './server';
import type { ScheduleContext } from './types';

export type CurrentUser = { id: string; name: string; photoUrl: string | null; isVolunteer: boolean };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The signed-in user for this JWT, or null. Works with any Supabase sign-in method (password, Microsoft...). */
export async function getCurrentUser(db: Db, token: string): Promise<CurrentUser | null> {
  const { data } = await db.auth.getUser(token);
  const id = data.user?.id;
  if (!id) return null;
  const [profile, volunteer] = await Promise.all([
    db.from('users').select('name,photo_url').eq('user_id', id).maybeSingle(),
    db.from('volunteer_profile').select('is_volunteer').eq('user_id', id).maybeSingle(),
  ]);
  if (!profile.data) return null;
  return { id, name: profile.data.name, photoUrl: profile.data.photo_url ?? null, isVolunteer: volunteer.data?.is_volunteer ?? false };
}

/**
 * An ACCEPTED support request the caller belongs to (requester or volunteer), or null.
 * Row-level security hides requests the caller is not part of, so "not yours" and "not found" look the same.
 */
export async function getAcceptedRequest(db: Db, requestId: string): Promise<ScheduleContext | null> {
  if (!UUID.test(requestId)) return null;
  const { data: r } = await db
    .from('support_request')
    .select('request_id,title,category,status,requester_id,volunteer_id')
    .eq('request_id', requestId)
    .maybeSingle();
  if (!r || r.status !== 'Accepted' || !r.volunteer_id) return null;
  const people = await loadParticipants(db, [r.requester_id, r.volunteer_id]);
  const requester = people.get(r.requester_id);
  const volunteer = people.get(r.volunteer_id);
  if (!requester || !volunteer) return null;
  return { requestId: r.request_id, requestTitle: r.title, category: r.category, requester, volunteer };
}
