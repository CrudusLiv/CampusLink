// Data access for sessions (server side). All queries use the signed-in user's client, so RLS applies.
import { mapDbError, type ApiError } from './errors';
import type { ScheduleInput } from './schemas';
import { loadParticipants, type Db } from './server';
import { generateSlots } from './slots';
import type { AvailabilityRow, AwaitingRequest, DayOfWeek, ScheduleContext, SessionView } from './types';
import { getAcceptedRequest } from './wrappers';

type SessionRow = {
  session_id: string;
  request_id: string;
  scheduled_datetime: string;
  support_mode: SessionView['supportMode'];
  status: SessionView['status'];
  meeting_link: string | null;
};
type RequestRow = { title: string; requester_id: string; volunteer_id: string };

const COLS = 'session_id,request_id,scheduled_datetime,support_mode,status,meeting_link';

/** The viewer's sessions, soonest first. `upcoming` keeps only those starting from now on. */
export async function listSessions(
  db: Db,
  viewerId: string,
  opts: { status?: SessionView['status']; upcoming?: boolean } = {},
): Promise<SessionView[]> {
  let q = db.from('session').select(`${COLS}, support_request!inner(title,requester_id,volunteer_id)`).order('scheduled_datetime');
  if (opts.status) q = q.eq('status', opts.status);
  if (opts.upcoming) q = q.gte('scheduled_datetime', new Date().toISOString());
  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as (SessionRow & { support_request: RequestRow })[];
  const people = await loadParticipants(db, rows.flatMap((r) => [r.support_request.requester_id, r.support_request.volunteer_id]));
  return rows.flatMap((r) => {
    const requester = people.get(r.support_request.requester_id);
    const volunteer = people.get(r.support_request.volunteer_id);
    return requester && volunteer ? [toView(r, r.support_request.title, requester, volunteer, viewerId)] : [];
  });
}

/** Keep only the requests whose id is not in `scheduledIds`. */
export function withoutScheduled<T extends { request_id: string }>(requests: T[], scheduledIds: Iterable<string>): T[] {
  const taken = new Set(scheduledIds);
  return requests.filter((r) => !taken.has(r.request_id));
}

/** The viewer's Accepted requests that do not have a Scheduled session yet, newest first. */
export async function listAwaitingRequests(db: Db, viewerId: string): Promise<AwaitingRequest[]> {
  const { data, error } = await db
    .from('support_request')
    .select('request_id,title,category,requester_id,volunteer_id')
    .eq('status', 'Accepted')
    .not('volunteer_id', 'is', null)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  const accepted = data ?? [];
  if (accepted.length === 0) return [];

  const { data: booked, error: bookedError } = await db
    .from('session')
    .select('request_id')
    .eq('status', 'Scheduled')
    .in('request_id', accepted.map((r) => r.request_id));
  if (bookedError) throw new Error(bookedError.message);

  const open = withoutScheduled(accepted, (booked ?? []).map((b) => b.request_id));
  const people = await loadParticipants(db, open.flatMap((r) => [r.requester_id, r.volunteer_id]));
  return open.flatMap((r) => {
    const other = people.get(viewerId === r.requester_id ? r.volunteer_id : r.requester_id);
    return other ? [{ requestId: r.request_id, requestTitle: r.title, category: r.category, other }] : [];
  });
}

/** Everything the Schedule screen needs: the request, and the volunteer's free one-hour slots. */
export async function getScheduleOptions(db: Db, requestId: string): Promise<{ context: ScheduleContext; slots: string[] } | null> {
  const context = await getAcceptedRequest(db, requestId);
  if (!context) return null;
  const [avail, busy] = await Promise.all([
    db.from('availability').select('day_of_week,start_time,end_time').eq('user_id', context.volunteer.id),
    db.rpc('get_busy_times', { p_request_id: requestId }),
  ]);
  const rows: AvailabilityRow[] = (avail.data ?? []).map((a) => ({
    dayOfWeek: a.day_of_week as DayOfWeek,
    startTime: a.start_time,
    endTime: a.end_time,
  }));
  const busyStarts = ((busy.data ?? []) as { scheduled_datetime: string }[]).map((b) => b.scheduled_datetime);
  return { context, slots: generateSlots(rows, busyStarts) };
}

/** Insert the session. The database has the last word on clashes, so a lost race comes back as slot_taken. */
export async function createSession(
  db: Db,
  viewerId: string,
  input: ScheduleInput,
  context: ScheduleContext,
): Promise<{ ok: true; session: SessionView } | { ok: false; error: ApiError }> {
  const { data, error } = await db
    .from('session')
    .insert({
      request_id: input.requestId,
      scheduled_datetime: input.scheduledDatetime,
      support_mode: input.supportMode,
      meeting_link: input.supportMode === 'Online' ? input.meetingLink ?? null : null,
    })
    .select(COLS)
    .single();
  if (error) return { ok: false, error: mapDbError(error) };
  return { ok: true, session: toView(data as SessionRow, context.requestTitle, context.requester, context.volunteer, viewerId) };
}

/** Complete a scheduled session and its support request atomically through the database RPC. */
export async function completeSession(db: Db, sessionId: string): Promise<{ ok: true } | { ok: false; error: ApiError }> {
  const { error } = await db.rpc('complete_session', { p_session_id: sessionId });
  if (!error) return { ok: true };

  const message = error.message ?? '';
  if (/SESSION_NOT_FOUND/.test(message)) {
    return { ok: false, error: { status: 404, error: 'not_found', message: 'Session not found' } };
  }
  if (/NOT_PARTICIPANT/.test(message) || error.code === '42501') {
    return { ok: false, error: { status: 403, error: 'forbidden', message: 'You can only complete your own support sessions' } };
  }
  if (/SESSION_NOT_SCHEDULED|REQUEST_NOT_ACCEPTED/.test(message)) {
    return { ok: false, error: { status: 409, error: 'invalid_status', message: 'Only a scheduled session for an accepted request can be completed' } };
  }
  return { ok: false, error: { status: 500, error: 'unknown', message: 'Something went wrong. Please try again.' } };
}

function toView(
  r: SessionRow,
  requestTitle: string,
  requester: SessionView['requester'],
  volunteer: SessionView['volunteer'],
  viewerId: string,
): SessionView {
  return {
    id: r.session_id,
    requestId: r.request_id,
    requestTitle,
    scheduledDatetime: new Date(r.scheduled_datetime).toISOString(),
    supportMode: r.support_mode,
    meetingLink: r.meeting_link,
    status: r.status,
    requester,
    volunteer,
    other: viewerId === requester.id ? volunteer : requester,
  };
}
