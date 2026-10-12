'use client';

import { useEffect, useState } from 'react';
import { fetchUpcoming, type PreviewState } from '@/lib/sessions/client';
import type { SessionView } from '@/lib/sessions/types';
import { EmptyState } from './EmptyState';
import { SessionCard } from './SessionCard';
import { SessionsSkeleton } from './SessionsSkeleton';
import s from './sessions.module.css';

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; sessions: SessionView[]; now: number };

/** Drop-in "upcoming sessions" list for any dashboard. Fetches its own data. */
export function UpcomingSessions({ preview }: { preview?: PreviewState }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    fetchUpcoming(preview)
      .then((list) => {
        const sessions = [...list].sort((a, b) => a.scheduledDatetime.localeCompare(b.scheduledDatetime)); // soonest first
        if (live) setState({ status: 'ready', sessions, now: Date.now() });
      })
      .catch(() => live && setState({ status: 'error' }));
    return () => {
      live = false;
    };
  }, [preview, attempt]);

  if (state.status === 'loading') return <SessionsSkeleton />;

  if (state.status === 'error') {
    return (
      <div className={s.error} role="alert">
        <span>We couldn&apos;t load your support sessions. Please try again.</span>
        <button
          type="button"
          className={s.btn}
          onClick={() => {
            setState({ status: 'loading' });
            setAttempt((n) => n + 1);
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (state.sessions.length === 0) return <EmptyState />;

  return (
    <ul className={s.list}>
      {state.sessions.map((session) => (
        <SessionCard key={session.id} session={session} now={state.now} />
      ))}
    </ul>
  );
}
