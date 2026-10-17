'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchScheduleOptions } from '@/lib/sessions/client';
import type { ScheduleContext } from '@/lib/sessions/types';
import { ScheduleForm } from './ScheduleForm';
import s from './sessions.module.css';

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'notfound' }
  | { status: 'ready'; context: ScheduleContext; slots: string[] };

/** Loads the accepted request and the volunteer's free slots, then shows the schedule form. */
export function ScheduleLoader({ requestId }: { requestId?: string }) {
  const [state, setState] = useState<State>(requestId ? { status: 'loading' } : { status: 'notfound' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!requestId) return;
    let live = true;
    fetchScheduleOptions(requestId)
      .then((opts) => live && setState(opts ? { status: 'ready', ...opts } : { status: 'notfound' }))
      .catch(() => live && setState({ status: 'error' }));
    return () => {
      live = false;
    };
  }, [requestId, attempt]);

  if (state.status === 'loading') {
    return (
      <p className={s.noSlots} role="status">
        Loading available times…
      </p>
    );
  }

  if (state.status === 'error') {
    return (
      <div className={s.error} role="alert">
        <span>We couldn&apos;t load this request. Please try again.</span>
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

  if (state.status === 'notfound') {
    return (
      <div className={s.empty}>
        <h3 className={s.emptyTitle}>Nothing to schedule here</h3>
        <p className={s.emptyText}>
          This page needs an accepted support request that belongs to you. Open it from one of your accepted requests.
        </p>
        <p>
          <Link className={s.backLink} href="/support-requests">
            Go to My Support Requests
          </Link>
        </p>
      </div>
    );
  }

  return <ScheduleForm context={state.context} slots={state.slots} />;
}
