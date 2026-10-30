'use client';

import { useEffect, useState } from 'react';
import { fetchHistory, type SessionRole } from '@/lib/sessions/client';
import type { SessionView } from '@/lib/sessions/types';
import { SessionCard } from './SessionCard';
import s from './sessions.module.css';

const PAGE = 10;

/** Cancelled or elapsed sessions, excluding completed sessions. Hidden when there are none. */
export function PastSessions({ role }: { role?: SessionRole }) {
  const [sessions, setSessions] = useState<SessionView[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    let live = true;
    fetchHistory(role)
      .then((list) => live && setSessions(list.filter((session) => session.status !== 'Completed')))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [role]);

  if (failed) return <p className={s.error} role="alert">We couldn&apos;t load your past sessions. Please refresh the page.</p>;
  if (!sessions || sessions.length === 0) return null;

  // ponytail: the full list is fetched once and sliced here; add server paging if history gets long.
  return (
    <section className={s.dashSection} aria-labelledby="past-title">
      <h2 id="past-title" className={s.sectionTitle}>Past sessions</h2>
      <ul className={s.list}>
        {sessions.slice(0, shown).map((session) => (
          <SessionCard key={session.id} session={session} />
        ))}
      </ul>
      {sessions.length > shown && (
        <button type="button" className={`${s.btn} ${s.showMore}`} onClick={() => setShown((n) => n + PAGE)}>
          Show more
        </button>
      )}
    </section>
  );
}
