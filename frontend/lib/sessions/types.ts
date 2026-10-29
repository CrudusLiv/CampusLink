export const SUPPORT_MODES = ['Online', 'In-Person'] as const; // "Chat / Text only" is not in the user stories
export type SupportMode = (typeof SUPPORT_MODES)[number];

export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

/** Name + photo only: nothing else about a user is exposed here (NFR8). */
export type Participant = { id: string; name: string; photoUrl: string | null };

export type SessionView = {
  id: string;
  requestId: string;
  requestTitle: string;
  requestDescription?: string | null; // what the Help Seeker asked for
  scheduledDatetime: string; // ISO, UTC
  supportMode: SupportMode;
  meetingLink: string | null;
  joinDetails: string | null; // where / how to join: a meeting link (Online) or a place (In-Person), set by the volunteer
  status: 'Scheduled' | 'Completed' | 'Cancelled';
  rating?: number; // from the feedback table, once the Help Seeker has submitted it
  feedback?: string;
  requester: Participant; // Help Seeker
  volunteer: Participant;
  other: Participant; // whichever of the two is NOT the viewer
};

export type ScheduleContext = {
  requestId: string;
  requestTitle: string;
  category: string;
  requester: Participant;
  volunteer: Participant;
};

export type AvailabilityRow = { dayOfWeek: DayOfWeek; startTime: string; endTime: string }; // 'HH:MM[:SS]'
