'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchAwaiting } from '@/lib/sessions/client';
import type { AwaitingRequest } from '@/lib/sessions/types';
import { Avatar } from './Avatar';
import s from './sessions.module.css';

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; requests: AwaitingRequest[] };

/** Accepted requests that still need a time, each with a "Schedule session" button. Hidden when there are none. */
export function AwaitingSessions() {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let live = true;
    fetchAwaiting()
      .then((requests) => live && setState({ status: 'ready', requests }))
      .catch(() => live && setState({ status: 'error' }));
    return () => {
      live = false;
    };
  }, []);

  if (state.status === 'loading') return null;
  if (state.status === 'error') {
    return (
      <p className={s.error} role="alert">
        We couldn&apos;t load your accepted requests.
      </p>
    );
  }
  if (state.requests.length === 0) return null;

  return (
    <section className={s.awaiting} aria-labelledby="awaiting-title">
      <h2 id="awaiting-title" className={s.sectionTitle}>Waiting for a time</h2>
      <p className={s.hint}>These support requests were accepted. Pick a time to confirm the session.</p>
      <ul className={s.list}>
        {state.requests.map((r) => (
          <li key={r.requestId} className={s.card}>
            <Avatar person={r.other} />
            <div className={s.cardBody}>
              <h3 className={s.cardTitle}>{r.requestTitle}</h3>
              <p className={s.cardMeta}>{r.category}</p>
              <p className={s.cardWith}>With {r.other.name}</p>
            </div>
            <Link className={`${s.btn} ${s.btnPrimary} ${s.btnLink}`} href={`/sessions/schedule?requestId=${r.requestId}`}>
              Schedule session
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
