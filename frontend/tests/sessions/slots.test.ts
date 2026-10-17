import { describe, expect, it } from 'vitest';
import { generateSlots, overlaps } from '@/lib/sessions/slots';
import type { AvailabilityRow } from '@/lib/sessions/types';

// Mon 12 Oct 2026, 09:00 in Kuala Lumpur (UTC+8) = 01:00 UTC.
const NOW = new Date('2026-10-12T01:00:00Z');
const mon = (startTime: string, endTime: string): AvailabilityRow => ({ dayOfWeek: 'Mon', startTime, endTime });

describe('generateSlots', () => {
  it('turns a Kuala Lumpur availability block into hourly UTC slots', () => {
    // Mon 10:00-12:00 KL on 12 Oct (after NOW) = 02:00 and 03:00 UTC
    const slots = generateSlots([mon('10:00:00', '12:00:00')], [], NOW, 1);
    expect(slots).toEqual(['2026-10-12T02:00:00.000Z', '2026-10-12T03:00:00.000Z']);
  });

  it('never offers a slot that has already started', () => {
    // block 08:00-12:00 KL, now is 09:00 KL: 08:00 and 09:00 are gone, 10:00 and 11:00 remain
    const slots = generateSlots([mon('08:00:00', '12:00:00')], [], NOW, 1);
    expect(slots[0]).toBe('2026-10-12T02:00:00.000Z');
    expect(slots).toHaveLength(2);
  });

  it('only offers whole hours that fit inside the block', () => {
    expect(generateSlots([mon('10:00:00', '10:30:00')], [], NOW, 1)).toEqual([]);
    // 10:30-12:00 -> first whole hour is 11:00, and 11:00-12:00 fits
    expect(generateSlots([mon('10:30:00', '12:00:00')], [], NOW, 1)).toEqual(['2026-10-12T03:00:00.000Z']);
  });

  it('removes slots that clash with busy times, including half-overlaps', () => {
    const busy = ['2026-10-12T02:00:00.000Z'];
    expect(generateSlots([mon('10:00:00', '12:00:00')], busy, NOW, 1)).toEqual(['2026-10-12T03:00:00.000Z']);
    // a session starting 30 min into the 10:00 slot blocks 10:00 and 11:00 alike
    const half = ['2026-10-12T02:30:00.000Z'];
    expect(generateSlots([mon('10:00:00', '12:00:00')], half, NOW, 1)).toEqual([]);
  });

  it('matches the weekday in Kuala Lumpur, not in UTC', () => {
    // Tue 13 Oct 00:00-02:00 KL is still Mon 16:00-18:00 UTC
    const tue: AvailabilityRow = { dayOfWeek: 'Tue', startTime: '00:00:00', endTime: '02:00:00' };
    expect(generateSlots([tue], [], NOW, 2)).toEqual(['2026-10-12T16:00:00.000Z', '2026-10-12T17:00:00.000Z']);
  });

  it('looks ahead 14 days by default and returns sorted, unique slots', () => {
    const slots = generateSlots([mon('10:00:00', '11:00:00'), mon('10:00:00', '11:00:00')], [], NOW);
    expect(slots).toEqual(['2026-10-12T02:00:00.000Z', '2026-10-19T02:00:00.000Z']);
    expect([...slots].sort()).toEqual(slots);
  });

  it('returns nothing when there is no availability', () => {
    expect(generateSlots([], [], NOW)).toEqual([]);
  });
});

describe('overlaps', () => {
  const t = Date.parse('2026-10-12T02:00:00Z');
  it('treats starts less than an hour apart as a clash', () => {
    expect(overlaps(t, t)).toBe(true);
    expect(overlaps(t, t + 59 * 60_000)).toBe(true);
    expect(overlaps(t, t - 59 * 60_000)).toBe(true);
  });
  it('allows back-to-back sessions', () => {
    expect(overlaps(t, t + 60 * 60_000)).toBe(false);
    expect(overlaps(t, t - 60 * 60_000)).toBe(false);
  });
});
