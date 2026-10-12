import type { Participant } from '@/lib/sessions/types';
import s from './sessions.module.css';

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');

export function Avatar({ person }: { person: Participant }) {
  if (person.photoUrl) {
    return (
      <span className={s.avatar}>
        {/* eslint-disable-next-line @next/next/no-img-element -- Storage host not yet in next.config images */}
        <img className={s.avatarImg} src={person.photoUrl} alt={`${person.name}'s profile photo`} />
      </span>
    );
  }
  return (
    <span className={s.avatar} role="img" aria-label={`${person.name} (no profile photo)`}>
      {initials(person.name)}
    </span>
  );
}
