import type { Metadata } from 'next';
import AppShell from '@/components/layout/AppShell';
import { AwaitingSessions } from '@/components/sessions/AwaitingSessions';
import { UpcomingSessions } from '@/components/sessions/UpcomingSessions';
import s from '@/components/sessions/sessions.module.css';

export const metadata: Metadata = { title: 'My Support Sessions | CampusLink' };

export default async function SessionsPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const { state } = await searchParams; // UI phase only: ?state=empty|error previews those states
  const preview = state === 'empty' || state === 'error' ? state : undefined;
  return (
    <AppShell title="My Support Sessions">
      <main className={s.content}>
        <AwaitingSessions />
        <h2 className={s.sectionTitle}>Upcoming</h2>
        <UpcomingSessions preview={preview} />
      </main>
    </AppShell>
  );
}
