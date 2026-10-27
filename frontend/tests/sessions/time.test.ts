import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatRange, formatTime, hasEnded, isWithin24h, klDateKey } from '@/lib/sessions/time';

const NOW = Date.parse('2026-10-12T01:00:00Z');
const at = (ms: number) => new Date(NOW + ms).toISOString();
const HOUR = 3_600_000;

describe('isWithin24h (0 <= scheduled - now < 24h)', () => {
  it('is true right now and just before the 24 hour mark', () => {
    expect(isWithin24h(at(0), NOW)).toBe(true);
    expect(isWithin24h(at(24 * HOUR - 1), NOW)).toBe(true);
  });
  it('is false at exactly 24 hours and beyond', () => {
    expect(isWithin24h(at(24 * HOUR), NOW)).toBe(false);
    expect(isWithin24h(at(48 * HOUR), NOW)).toBe(false);
  });
  it('is false for sessions already in the past', () => {
    expect(isWithin24h(at(-1), NOW)).toBe(false);
    expect(isWithin24h(at(-5 * HOUR), NOW)).toBe(false);
  });
});

describe('Kuala Lumpur display', () => {
  it('shows the time in Kuala Lumpur, not UTC', () => {
    expect(formatTime('2026-10-12T02:00:00Z')).toBe('10:00 AM');
    expect(formatTime('2026-10-12T14:30:00Z')).toBe('10:30 PM');
  });
  it('rolls the date over at KL midnight', () => {
    expect(klDateKey('2026-10-12T15:59:00Z')).toBe('2026-10-12');
    expect(klDateKey('2026-10-12T16:00:00Z')).toBe('2026-10-13');
  });
  it('formats a readable date', () => {
    expect(formatDate('2026-10-12T02:00:00Z')).toMatch(/Mon/);
    expect(formatDate('2026-10-12T02:00:00Z')).toMatch(/12/);
  });
});

describe('session display helpers', () => {
  const iso = '2026-10-27T02:00:00Z'; // Tue 27 Oct, 10:00 AM in Kuala Lumpur
  it('shows the weekday, date and time', () => expect(formatDateTime(iso)).toBe('Tue, 27 Oct, 10:00 AM'));
  it('shows a one-hour range', () => expect(formatRange(iso)).toBe('10:00 AM – 11:00 AM'));
  it('has ended only once the hour is over', () => {
    const start = Date.parse(iso);
    expect(hasEnded(iso, start + HOUR - 1)).toBe(false);
    expect(hasEnded(iso, start + HOUR)).toBe(true);
  });
});
