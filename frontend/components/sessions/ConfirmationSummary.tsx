import Link from 'next/link';
import { formatDate, formatTime } from '@/lib/sessions/time';
import type { SessionView } from '@/lib/sessions/types';
import { Avatar } from './Avatar';
import s from './sessions.module.css';

export function ConfirmationSummary({ session }: { session: SessionView }) {
  const iso = session.scheduledDatetime;
  return (
    <section className={s.confirm} aria-live="polite">
      <h2 className={s.confirmHead}>Support Session scheduled</h2>
      <p className={s.hint}>Status: {session.status}</p>
      <dl className={s.summary}>
        <dt>Request</dt>
        <dd>{session.requestTitle}</dd>
        <dt>Date</dt>
        <dd>{formatDate(iso)}</dd>
        <dt>Time</dt>
        <dd>{formatTime(iso)} (Kuala Lumpur)</dd>
        <dt>Mode</dt>
        <dd>{session.supportMode}</dd>
        {session.meetingLink && (
          <>
            <dt>Meeting link</dt>
            <dd>{session.meetingLink}</dd>
          </>
        )}
        <dt>Participants</dt>
        <dd className={s.people}>
          <span className={s.person}>
            <Avatar person={session.requester} /> {session.requester.name} (Help Seeker)
          </span>
          <span className={s.person}>
            <Avatar person={session.volunteer} /> {session.volunteer.name} (Volunteer)
          </span>
        </dd>
      </dl>
      <Link className={`${s.btn} ${s.btnPrimary}`} href="/sessions" style={{ display: 'inline-block', textDecoration: 'none' }}>
        View My Support Sessions
      </Link>
    </section>
  );
}
