// Data facade used by the components. UI phase: backed by mocks.
// Swap the bodies for fetch('/api/sessions') calls once the route exists; signatures stay.
import { mockUpcoming, MOCK_CONTEXT } from './mock';
import type { ScheduleInput } from './schemas';
import type { SessionView } from './types';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
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

export type PreviewState = 'empty' | 'error';

export async function fetchUpcoming(preview?: PreviewState): Promise<SessionView[]> {
  await delay(700);
  if (preview === 'error') throw new Error('mock error');
  if (preview === 'empty') return [];
  const updates = readSessionUpdates();
  return mockUpcoming().map((session) => ({ ...session, ...updates[session.id] }));
}

export async function fetchSession(id: string): Promise<SessionView | null> {
  const sessions = await fetchUpcoming();
  return sessions.find((session) => session.id === id) ?? null;
}

export type ScheduleResult =
  | { ok: true; session: SessionView }
  | { ok: false; error: 'slot_taken' | 'unknown'; message: string };

export async function scheduleSession(input: ScheduleInput): Promise<ScheduleResult> {
  await delay(700);
  const { requester, volunteer, requestTitle } = MOCK_CONTEXT;
  return {
    ok: true,
    session: {
      id: 'c1b2c3d4-0009-4000-8000-000000000009',
      requestId: input.requestId,
      requestTitle,
      scheduledDatetime: input.scheduledDatetime,
      supportMode: input.supportMode,
      meetingLink: input.meetingLink ?? null,
      status: 'Scheduled',
      requester,
      volunteer,
      other: volunteer,
    },
  };
}
