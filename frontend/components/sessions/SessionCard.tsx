import { joinUrl } from '@/lib/sessions/join';
import { formatDateTime, hasEnded, isWithin24h } from '@/lib/sessions/time';
import Link from 'next/link';
import type { SessionView } from '@/lib/sessions/types';
import { Avatar } from './Avatar';
import s from './sessions.module.css';

export function SessionCard({ session, now }: { session: SessionView; now?: number }) {
  const soon = isWithin24h(session.scheduledDatetime, now);
  const iso = session.scheduledDatetime;
  return (
    <li className={`${s.card} ${soon ? s.cardSoon : ''}`}>
      <Link className={s.cardMain} href={`/sessions/${session.id}`} aria-label={`View ${session.requestTitle} session details`}>
        <Avatar person={session.other} />
        <div className={s.cardBody}>
          <h3 className={s.cardTitle}>{session.requestTitle}</h3>
          <p className={s.cardMeta}>
            <time dateTime={iso}>{formatDateTime(iso)}</time> · {session.supportMode}
          </p>
          <p className={s.cardWith}>With {session.other.name}</p>
        </div>
      </Link>
      {session.status === 'Scheduled' && joinUrl(session) && (
        <a className={s.link} href={joinUrl(session) ?? undefined} target="_blank" rel="noopener noreferrer">Join meeting</a>
      )}
      {soon && <span className={s.badgeSoon}>Within 24h</span>}
      {session.status !== 'Scheduled' && (
        <span className={session.status === 'Completed' ? s.badgeDone : s.badgeCancelled}>{session.status}</span>
      )}
      {session.status === 'Scheduled' && hasEnded(iso, now) && <span className={s.badgeCancelled}>Time passed</span>}
    </li>
  );
}
