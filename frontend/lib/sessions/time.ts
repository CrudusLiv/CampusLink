export const TZ = 'Asia/Kuala_Lumpur';
const DAY_MS = 86_400_000;

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-MY', { timeZone: TZ, ...opts });
const dateFmt = fmt({ weekday: 'short', day: 'numeric', month: 'short' });
const timeFmt = fmt({ hour: 'numeric', minute: '2-digit', hour12: true });
const keyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }); // YYYY-MM-DD

export const formatDate = (iso: string) => dateFmt.format(new Date(iso));
export const formatTime = (iso: string) => timeFmt.format(new Date(iso)).toUpperCase();
/** Calendar-day key in Kuala Lumpur, e.g. "2026-10-13". */
export const klDateKey = (iso: string) => keyFmt.format(new Date(iso));

/** "Within 24h" rule: 0 <= scheduled - now < 24h. */
export function isWithin24h(iso: string, now: number = Date.now()) {
  const diff = new Date(iso).getTime() - now;
  return diff >= 0 && diff < DAY_MS;
}
