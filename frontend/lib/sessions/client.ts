// Data facade used by the components. UI phase: backed by mocks.
// Swap the bodies for fetch('/api/sessions') calls once the route exists; signatures stay.
import { mockUpcoming, MOCK_CONTEXT } from './mock';
import type { ScheduleInput } from './schemas';
import type { SessionView } from './types';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type PreviewState = 'empty' | 'error';

export async function fetchUpcoming(preview?: PreviewState): Promise<SessionView[]> {
  await delay(700);
  if (preview === 'error') throw new Error('mock error');
  if (preview === 'empty') return [];
  return mockUpcoming();
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
