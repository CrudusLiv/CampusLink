import type { Metadata } from 'next';
import Link from 'next/link';
import { UpcomingSessions } from '@/components/sessions/UpcomingSessions';
import s from '@/components/sessions/sessions.module.css';

export const metadata: Metadata = { title: 'My Support Sessions | CampusLink' };

export default async function SessionsPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const { state } = await searchParams; // UI phase only: ?state=empty|error previews those states
  const preview = state === 'empty' || state === 'error' ? state : undefined;
  return (
    <div className={s.page}>
      <header className={s.pageHeader}>
        <Link className={s.backLink} href="/dashboard">← Dashboard</Link>
        <h1 className={s.pageTitle}>My Support Sessions</h1>
      </header>
      <main className={s.content}>
        <h2 className={s.sectionTitle}>Upcoming</h2>
        <UpcomingSessions preview={preview} />
      </main>
    </div>
  );
}
