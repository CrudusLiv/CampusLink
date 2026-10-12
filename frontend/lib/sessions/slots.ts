import type { AvailabilityRow, DayOfWeek } from './types';

export const SLOT_MINUTES = 60; // also the fixed session length: SESSION has no end column
export const HORIZON_DAYS = 14;

const MIN_MS = 60_000;
const DAY_MS = 86_400_000;
const KL_OFFSET_MS = 8 * 3_600_000; // Kuala Lumpur is UTC+8 all year (no DST)
const DAYS: DayOfWeek[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

/** Two sessions clash when their starts are less than one slot apart. */
export const overlaps = (aMs: number, bMs: number) => Math.abs(aMs - bMs) < SLOT_MINUTES * MIN_MS;

/**
 * Bookable slot starts (ISO, UTC) from a volunteer's weekly availability, read as
 * Asia/Kuala_Lumpur wall time, minus past slots and anything clashing with `busy`.
 */
export function generateSlots(
  rows: AvailabilityRow[],
  busy: string[] = [],
  now: Date = new Date(),
  days: number = HORIZON_DAYS,
): string[] {
  const busyMs = busy.map((b) => new Date(b).getTime());
  const klMidnight = Math.floor((now.getTime() + KL_OFFSET_MS) / DAY_MS) * DAY_MS; // KL "today" 00:00, shifted clock
  const out = new Set<string>();

  for (let i = 0; i < days; i++) {
    const day = klMidnight + i * DAY_MS;
    const dow = DAYS[new Date(day).getUTCDay()];
    for (const r of rows) {
      if (r.dayOfWeek !== dow) continue;
      const end = toMinutes(r.endTime);
      for (let m = Math.ceil(toMinutes(r.startTime) / SLOT_MINUTES) * SLOT_MINUTES; m + SLOT_MINUTES <= end; m += SLOT_MINUTES) {
        const utc = day + m * MIN_MS - KL_OFFSET_MS;
        if (utc <= now.getTime() || busyMs.some((b) => overlaps(b, utc))) continue;
        out.add(new Date(utc).toISOString());
      }
    }
  }
  return [...out].sort();
}
