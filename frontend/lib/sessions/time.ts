export const TZ = 'Asia/Kuala_Lumpur';
const DAY_MS = 86_400_000;

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-MY', { timeZone: TZ, ...opts });
const dateFmt = fmt({ weekday: 'short', day: 'numeric', month: 'short' });
const timeFmt = fmt({ hour: 'numeric', minute: '2-digit', hour12: true });
const keyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }); // YYYY-MM-DD

export const formatDate = (iso: string) => dateFmt.format(new Date(iso));
export const formatTime = (iso: string) => timeFmt.format(new Date(iso)).toUpperCase();
/** "Mon, 27 Oct, 10:00 AM" */
export const formatDateTime = (iso: string) => `${formatDate(iso)}, ${formatTime(iso)}`;
/** "10:00 AM – 11:00 AM": sessions are always one hour. */
export const formatRange = (iso: string) => `${formatTime(iso)} – ${formatTime(new Date(new Date(iso).getTime() + 3_600_000).toISOString())}`;
/** A Scheduled session whose hour is over: it can no longer be "upcoming". */
export const hasEnded = (iso: string, now: number = Date.now()) => new Date(iso).getTime() + 3_600_000 <= now;
/** Calendar-day key in Kuala Lumpur, e.g. "2026-10-13". */
export const klDateKey = (iso: string) => keyFmt.format(new Date(iso));

/** "Within 24h" rule: 0 <= scheduled - now < 24h. */
export function isWithin24h(iso: string, now: number = Date.now()) {
  const diff = new Date(iso).getTime() - now;
  return diff >= 0 && diff < DAY_MS;
}
