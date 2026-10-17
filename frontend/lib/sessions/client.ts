// Browser-side data facade for the sessions screens. Talks to /api/sessions with the signed-in user's token.
import { supabase } from '@/lib/supabaseClient';
import type { ScheduleInput } from './schemas';
import type { AwaitingRequest, ScheduleContext, SessionView } from './types';

// ---- Browser-only edits made by the session detail page (reschedule / cancel / complete / rating). ----
// These are NOT saved to the database yet (Iteration 2 replaces them with real PATCH calls + the feedback table).
const SESSION_UPDATES_KEY = 'campuslink.session.updates.v1';

type SessionUpdate = Partial<Pick<SessionView, 'scheduledDatetime' | 'status' | 'rating' | 'feedback' | 'rescheduleNote'>>;

function readSessionUpdates(): Record<string, SessionUpdate> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(SESSION_UPDATES_KEY) ?? '{}') as Record<string, SessionUpdate>;
  } catch {
    return {};
  }
}

export function updateMockSession(id: string, update: SessionUpdate) {
  try {
    const updates = readSessionUpdates();
    updates[id] = { ...updates[id], ...update };
    window.localStorage.setItem(SESSION_UPDATES_KEY, JSON.stringify(updates));
    return true;
  } catch {
    return false;
  }
}

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
  const updates = readSessionUpdates();
  return (body.sessions as SessionView[]).map((session) => ({ ...session, ...updates[session.id] }));
}

export async function fetchSession(id: string): Promise<SessionView | null> {
  const sessions = await fetchUpcoming();
  return sessions.find((session) => session.id === id) ?? null;
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
