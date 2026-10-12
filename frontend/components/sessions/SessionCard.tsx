import { formatDate, formatTime, isWithin24h } from '@/lib/sessions/time';
import type { SessionView } from '@/lib/sessions/types';
import { Avatar } from './Avatar';
import s from './sessions.module.css';

export function SessionCard({ session, now }: { session: SessionView; now?: number }) {
  const soon = isWithin24h(session.scheduledDatetime, now);
  const iso = session.scheduledDatetime;
  return (
    <li className={`${s.card} ${soon ? s.cardSoon : ''}`}>
      <Avatar person={session.other} />
      <div className={s.cardBody}>
        <h3 className={s.cardTitle}>{session.requestTitle}</h3>
        <p className={s.cardMeta}>
          <time dateTime={iso}>
            {formatDate(iso)} · {formatTime(iso)}
          </time>{' '}
          · {session.supportMode}
        </p>
        <p className={s.cardWith}>With {session.other.name}</p>
        {session.supportMode === 'Online' && session.meetingLink && (
          <a className={s.link} href={session.meetingLink} target="_blank" rel="noopener noreferrer">
            Join meeting link
          </a>
        )}
      </div>
      {soon && <span className={s.badgeSoon}>Within 24h</span>}
    </li>
  );
}
