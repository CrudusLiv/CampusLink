// UI-phase fixtures only. Deleted once the real data layer lands. Synthetic people, valid v4 UUIDs.
import type { AvailabilityRow, Participant, ScheduleContext, SessionView } from './types';

const HOUR = 3_600_000;
const person = (n: number, name: string): Participant => ({
  id: `a1b2c3d4-000${n}-4000-8000-00000000000${n}`,
  name,
  photoUrl: null,
});

const me = person(1, 'Livnes Ganesan');
const jane = person(2, 'Jane Doe');
const ali = person(3, 'Ali Rahman');

export const MOCK_AVAILABILITY: AvailabilityRow[] = (['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const).flatMap((dayOfWeek) => [
  { dayOfWeek, startTime: '10:00:00', endTime: '12:00:00' },
  { dayOfWeek, startTime: '14:00:00', endTime: '17:00:00' },
]);

export const MOCK_CONTEXT: ScheduleContext = {
  requestId: 'b1b2c3d4-0001-4000-8000-000000000001',
  requestTitle: 'Math tutoring',
  category: 'Academic',
  requester: me,
  volunteer: jane,
};

export function mockUpcoming(now: number = Date.now()): SessionView[] {
  const mk = (i: number, offsetH: number, title: string, mode: SessionView['supportMode'], other: Participant, link: string | null): SessionView => ({
    id: `c1b2c3d4-000${i}-4000-8000-00000000000${i}`,
    requestId: `b1b2c3d4-000${i}-4000-8000-00000000000${i}`,
    requestTitle: title,
    scheduledDatetime: new Date(now + offsetH * HOUR).toISOString(),
    supportMode: mode,
    meetingLink: link,
    status: 'Scheduled',
    requester: me,
    volunteer: other,
    other,
  });
  return [
    mk(1, 5, 'Math tutoring', 'Online', jane, 'https://meet.google.com/abc-defg-hij'),
    mk(2, 50, 'Laptop setup', 'In-Person', ali, null),
    mk(3, 121, 'Exam stress chat', 'Chat', jane, null),
  ];
}
