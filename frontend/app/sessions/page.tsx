import type { Metadata } from 'next';
import AppShell from '@/components/layout/AppShell';
import { PastSessions } from '@/components/sessions/PastSessions';
import { UpcomingSessions } from '@/components/sessions/UpcomingSessions';
import s from '@/components/sessions/sessions.module.css';

export const metadata: Metadata = { title: 'My Support Sessions | CampusLink' };

export default async function SessionsPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const { state } = await searchParams; // UI phase only: ?state=empty|error previews those states
  const preview = state === 'empty' || state === 'error' ? state : undefined;
  return (
    <AppShell title="My Support Sessions">
      <main className={s.content}>
        <h2 className={s.sectionTitle}>Upcoming sessions</h2>
        <p className={s.hint}>A session is booked automatically when a Volunteer accepts a request. Soonest first.</p>
        <UpcomingSessions preview={preview} />
        <PastSessions />
      </main>
    </AppShell>
  );
}
