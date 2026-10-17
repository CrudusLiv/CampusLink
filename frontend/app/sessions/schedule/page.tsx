import type { Metadata } from 'next';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import { ScheduleLoader } from '@/components/sessions/ScheduleLoader';
import s from '@/components/sessions/sessions.module.css';

export const metadata: Metadata = { title: 'Schedule Support Session | CampusLink' };

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ requestId?: string }> }) {
  const { requestId } = await searchParams;
  return (
    <AppShell title="Schedule Support Session">
      <main className={s.content}>
        <p><Link className={s.backLink} href="/sessions">← My Support Sessions</Link></p>
        <ScheduleLoader requestId={requestId} />
      </main>
    </AppShell>
  );
}
