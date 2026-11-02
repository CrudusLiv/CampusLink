'use client';

import { useVolunteerDashboardView } from '@/components/dashboard/VolunteerViewContext';
import type { PreviewState } from '@/lib/sessions/client';
import { PastSessions } from './PastSessions';
import { UpcomingSessions } from './UpcomingSessions';
import s from './sessions.module.css';

export default function SessionsView({ preview }: { preview?: PreviewState }) {
  const { view } = useVolunteerDashboardView();
  return <>
    <h2 className={s.sectionTitle}>Upcoming sessions</h2>
    <p className={s.hint}>A session is booked automatically when a Volunteer accepts a request. Soonest first.</p>
    <UpcomingSessions preview={preview} role={view} />
    <PastSessions role={view} />
  </>;
}
