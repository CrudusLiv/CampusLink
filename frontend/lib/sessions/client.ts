// Browser-side data facade for the sessions screens. Talks to /api/sessions with the signed-in user's token.
import { supabase } from '@/lib/supabaseClient';
import type { ScheduleInput } from './schemas';
import type { AwaitingRequest, ScheduleContext, SessionView } from './types';

// ---- API calls ----
async function api(path: string, init: { method?: string; body?: unknown } = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(path, {
    method: init.method ?? 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as Record<string, unknown> | null };
}

/** `preview` only exists so the UI states can be demoed with /sessions?state=empty|error. */
export type PreviewState = 'empty' | 'error';

export async function fetchUpcoming(preview?: PreviewState): Promise<SessionView[]> {
  if (preview === 'error') throw new Error('preview error');
  if (preview === 'empty') return [];
  const { status, body } = await api('/api/sessions?status=Scheduled&upcoming=true');
  if (status !== 200 || !body) throw new Error(`Could not load sessions (${status})`);
  return body.sessions as SessionView[];
}

/** Completed + Cancelled sessions, newest first. */
export async function fetchHistory(): Promise<SessionView[]> {
  const { status, body } = await api('/api/sessions?history=true');
  if (status !== 200 || !body) throw new Error(`Could not load session history (${status})`);
  return body.sessions as SessionView[];
}

export async function fetchSession(id: string): Promise<SessionView | null> {
  const { status, body } = await api(`/api/sessions?id=${encodeURIComponent(id)}`);
  if (status !== 200 || !body) throw new Error(`Could not load the session (${status})`);
  return (body.sessions as SessionView[])[0] ?? null;
}

/** Accepted requests that still need a session time. */
export async function fetchAwaiting(): Promise<AwaitingRequest[]> {
  const { status, body } = await api('/api/sessions/awaiting');
  if (status !== 200 || !body) throw new Error(`Could not load accepted requests (${status})`);
  return body.requests as AwaitingRequest[];
}

/** The accepted request + free slots for the Schedule screen. null = not found / not accepted / not yours. */
export async function fetchScheduleOptions(requestId: string): Promise<{ context: ScheduleContext; slots: string[] } | null> {
  const { status, body } = await api(`/api/sessions/schedule-context?requestId=${encodeURIComponent(requestId)}`);
  if (status === 404) return null;
  if (status !== 200 || !body) throw new Error(`Could not load scheduling options (${status})`);
  return body as unknown as { context: ScheduleContext; slots: string[] };
}

export type ScheduleResult = { ok: true; session: SessionView } | { ok: false; error: string; message: string };

export async function scheduleSession(input: ScheduleInput): Promise<ScheduleResult> {
  const { status, body } = await api('/api/sessions', { method: 'POST', body: input });
  if (status === 201 && body) return { ok: true, session: body.session as SessionView };
  return {
    ok: false,
    error: String(body?.error ?? 'unknown'),
    message: String(body?.message ?? 'Something went wrong. Please try again.'),
  };
}

export type ActionResult = { ok: true } | { ok: false; message: string };

const toResult = ({ status, body }: Awaited<ReturnType<typeof api>>): ActionResult =>
  status === 200 || status === 201 ? { ok: true } : { ok: false, message: String(body?.message ?? 'Something went wrong. Please try again.') };

/** Volunteer marks a session completed (database transaction, checked server side). */
export const completeSession = (sessionId: string) => api('/api/sessions', { method: 'PATCH', body: { sessionId, action: 'complete' } }).then(toResult);

export const cancelSession = (sessionId: string) => api('/api/sessions', { method: 'PATCH', body: { sessionId, action: 'cancel' } }).then(toResult);

/** Help Seeker's feedback: one per session, read-only afterwards. */
export const sendFeedback = (sessionId: string, rating: number, comment: string) =>
  api('/api/sessions/feedback', { method: 'POST', body: { sessionId, rating, comment: comment.trim() || undefined } }).then(toResult);
