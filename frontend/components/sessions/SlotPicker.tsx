'use client';

import { useMemo, useState } from 'react';
import { formatDate, formatTime, klDateKey } from '@/lib/sessions/time';
import s from './sessions.module.css';

type Props = { slots: string[]; value: string | null; onChange: (iso: string) => void };

/** Date buttons, then time buttons for the chosen date. All native buttons, so fully keyboard-usable. */
export function SlotPicker({ slots, value, onChange }: Props) {
  const byDay = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const iso of slots) m.set(klDateKey(iso), [...(m.get(klDateKey(iso)) ?? []), iso]);
    return m;
  }, [slots]);
  const [picked, setPicked] = useState<string | null>(null);

  if (byDay.size === 0) {
    return (
      <p className={s.noSlots} role="status">
        No free times in the next 14 days. The Volunteer&apos;s availability may be fully booked or not set yet.
      </p>
    );
  }

  const day = (picked && byDay.has(picked) ? picked : null) ?? (value ? klDateKey(value) : null) ?? [...byDay.keys()][0];

  return (
    <>
      <div className={s.dateStrip} role="group" aria-label="Choose a date">
        {[...byDay].map(([key, list]) => (
          <button
            key={key}
            type="button"
            className={`${s.dateBtn} ${key === day ? s.dateBtnActive : ''}`}
            aria-pressed={key === day}
            onClick={() => setPicked(key)}
          >
            {formatDate(list[0])}
          </button>
        ))}
      </div>
      <div className={s.timeGrid} role="group" aria-label={`Choose a time on ${formatDate(byDay.get(day)![0])}`}>
        {byDay.get(day)!.map((iso) => (
          <button
            key={iso}
            type="button"
            className={`${s.timeBtn} ${iso === value ? s.timeBtnActive : ''}`}
            aria-pressed={iso === value}
            onClick={() => onChange(iso)}
          >
            {formatTime(iso)}
          </button>
        ))}
      </div>
    </>
  );
}
