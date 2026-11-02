import type { Metadata } from 'next';
import AppShell from '@/components/layout/AppShell';
import s from '@/components/sessions/sessions.module.css';
import SessionsView from '@/components/sessions/SessionsView';

export const metadata: Metadata = { title: 'My Support Sessions | CampusLink' };

export default async function SessionsPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const { state } = await searchParams; // UI phase only: ?state=empty|error previews those states
  const preview = state === 'empty' || state === 'error' ? state : undefined;
  return (
    <AppShell title="My Support Sessions">
      <main className={s.content}>
        <SessionsView preview={preview} />
      </main>
    </AppShell>
  );
}
