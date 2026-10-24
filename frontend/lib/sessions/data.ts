// Data access for sessions (server side). All queries use the signed-in user's client, so RLS applies.
import { mapDbError, type ApiError } from './errors';
import type { FeedbackInput, ScheduleInput } from './schemas';
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
type RequestRow = { title: string; description: string | null; requester_id: string; volunteer_id: string };

const COLS = 'session_id,request_id,scheduled_datetime,support_mode,status,meeting_link';

/**
 * The viewer's sessions, soonest first. `upcoming` keeps only those starting from now on;
 * `history` returns Completed + Cancelled, newest first; `id` returns that one session.
 */
export async function listSessions(
  db: Db,
  viewerId: string,
  opts: { status?: SessionView['status']; upcoming?: boolean; history?: boolean; id?: string } = {},
): Promise<SessionView[]> {
  // A session stays "upcoming" until its hour is over; after that, if nobody marked it completed, it moves to history.
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  let q = db.from('session').select(`${COLS}, support_request!inner(title,description,requester_id,volunteer_id)`);
  q = q.order('scheduled_datetime', { ascending: !opts.history });
  if (opts.id) q = q.eq('session_id', opts.id);
  if (opts.status) q = q.eq('status', opts.status);
  if (opts.history) q = q.or(`status.in.(Completed,Cancelled),scheduled_datetime.lt.${hourAgo}`);
  if (opts.upcoming) q = q.gte('scheduled_datetime', hourAgo);
  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as (SessionRow & { support_request: RequestRow })[];
  const people = await loadParticipants(db, rows.flatMap((r) => [r.support_request.requester_id, r.support_request.volunteer_id]));
  const feedback = await loadFeedback(db, rows.filter((r) => r.status === 'Completed').map((r) => r.session_id));
  return rows.flatMap((r) => {
    const requester = people.get(r.support_request.requester_id);
    const volunteer = people.get(r.support_request.volunteer_id);
    return requester && volunteer ? [{ ...toView(r, r.support_request.title, requester, volunteer, viewerId), requestDescription: r.support_request.description, ...feedback.get(r.session_id) }] : [];
  });
}

async function loadFeedback(db: Db, sessionIds: string[]): Promise<Map<string, { rating: number; feedback?: string }>> {
  if (sessionIds.length === 0) return new Map();
  const { data } = await db.from('feedback').select('session_id,rating,comment').in('session_id', sessionIds);
  return new Map((data ?? []).map((f) => [f.session_id, { rating: f.rating, feedback: f.comment ?? undefined }]));
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

type RpcResult = { ok: true } | { ok: false; error: ApiError };

/** Complete a scheduled session and its support request atomically through the database RPC. */
export async function completeSession(db: Db, sessionId: string): Promise<RpcResult> {
  return mapRpc(await db.rpc('complete_session', { p_session_id: sessionId }), 'complete');
}

/** Cancel a scheduled session through the database RPC. */
export async function cancelSession(db: Db, sessionId: string): Promise<RpcResult> {
  return mapRpc(await db.rpc('cancel_session', { p_session_id: sessionId }), 'cancel');
}

function mapRpc({ error }: { error: { message?: string; code?: string } | null }, verb: 'complete' | 'cancel'): RpcResult {
  if (!error) return { ok: true };
  const message = error.message ?? '';
  const fail = (status: number, code: string, text: string): RpcResult => ({ ok: false, error: { status, error: code, message: text } });
  if (/SESSION_NOT_FOUND/.test(message)) return fail(404, 'not_found', 'Session not found');
  if (/NOT_VOLUNTEER/.test(message)) return fail(403, 'forbidden', 'Only the volunteer can mark a session as completed');
  if (/NOT_PARTICIPANT/.test(message) || error.code === '42501') return fail(403, 'forbidden', `You can only ${verb} your own support sessions`);
  if (/SESSION_NOT_STARTED/.test(message)) return fail(409, 'not_started', 'You can mark a session as completed once its time has passed');
  if (/SESSION_NOT_SCHEDULED|REQUEST_NOT_ACCEPTED/.test(message)) {
    return fail(409, 'invalid_status', `Only a scheduled session can be ${verb === 'cancel' ? 'cancelled' : 'completed'}`);
  }
  return fail(500, 'unknown', 'Something went wrong. Please try again.');
}

/** Save the Help Seeker's feedback. The database allows one per completed session and no edits. */
export async function submitFeedback(db: Db, input: FeedbackInput): Promise<RpcResult> {
  const { data: session } = await db
    .from('session')
    .select('status, support_request!inner(volunteer_id)')
    .eq('session_id', input.sessionId)
    .maybeSingle();
  if (!session) return { ok: false, error: { status: 404, error: 'not_found', message: 'Session not found' } };
  if (session.status !== 'Completed') {
    return { ok: false, error: { status: 409, error: 'not_completed', message: 'You can leave feedback once the session is completed' } };
  }
  const request = session.support_request as unknown as { volunteer_id: string };
  const { error } = await db.from('feedback').insert({
    session_id: input.sessionId,
    volunteer_id: request.volunteer_id,
    rating: input.rating,
    comment: input.comment || null,
  });
  if (!error) return { ok: true };
  if (error.code === '23505') return { ok: false, error: { status: 409, error: 'already_submitted', message: 'You already left feedback for this session' } };
  if (error.code === '42501') return { ok: false, error: { status: 403, error: 'forbidden', message: 'Only the Help Seeker can leave feedback' } };
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
