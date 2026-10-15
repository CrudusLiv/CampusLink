import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import AppShell from '@/components/layout/AppShell';
import { ScheduleForm } from '@/components/sessions/ScheduleForm';
import s from '@/components/sessions/sessions.module.css';
import { MOCK_AVAILABILITY, MOCK_CONTEXT } from '@/lib/sessions/mock';
import { generateSlots } from '@/lib/sessions/slots';

export const metadata: Metadata = { title: 'Schedule Support Session | CampusLink' };

export default async function SchedulePage() {
  await connection(); // slots depend on "now", so never prerender this page
  const slots = generateSlots(MOCK_AVAILABILITY, [], new Date()); // UI phase: mock availability
  return (
    <AppShell title="Schedule Support Session">
      <main className={s.content}>
        <p><Link className={s.backLink} href="/sessions">← My Support Sessions</Link></p>
        <ScheduleForm context={MOCK_CONTEXT} slots={slots} />
      </main>
    </AppShell>
  );
}
