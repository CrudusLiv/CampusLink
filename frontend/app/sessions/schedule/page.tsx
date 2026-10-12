import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { ScheduleForm } from '@/components/sessions/ScheduleForm';
import s from '@/components/sessions/sessions.module.css';
import { MOCK_AVAILABILITY, MOCK_CONTEXT } from '@/lib/sessions/mock';
import { generateSlots } from '@/lib/sessions/slots';

export const metadata: Metadata = { title: 'Schedule Support Session | CampusLink' };

export default async function SchedulePage() {
  await connection(); // slots depend on "now", so never prerender this page
  const slots = generateSlots(MOCK_AVAILABILITY, [], new Date()); // UI phase: mock availability
  return (
    <div className={s.page}>
      <header className={s.pageHeader}>
        <Link className={s.backLink} href="/sessions">← My Support Sessions</Link>
        <h1 className={s.pageTitle}>Schedule Support Session</h1>
      </header>
      <main className={s.content}>
        <ScheduleForm context={MOCK_CONTEXT} slots={slots} />
      </main>
    </div>
  );
}
