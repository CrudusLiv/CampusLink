import { describe, expect, it } from 'vitest';
import { cellKey, cellsToSlots, HOURS, isDayFull, toggleDay, weekdayHours, weekSummary } from '@/lib/availability-grid';

describe('availability grid helpers', () => {
  it('turns back-to-back hours into one range and keeps gaps as separate ranges', () => {
    const cells = new Set([cellKey('Mon', 10), cellKey('Mon', 11), cellKey('Mon', 14), cellKey('Wed', 9)]);
    expect(cellsToSlots(cells)).toEqual([
      { day_of_week: 'Mon', start_time: '10:00', end_time: '12:00' },
      { day_of_week: 'Mon', start_time: '14:00', end_time: '15:00' },
      { day_of_week: 'Wed', start_time: '09:00', end_time: '10:00' },
    ]);
    expect(weekSummary(cells)).toEqual(['Mon 10:00–12:00', 'Mon 14:00–15:00', 'Wed 09:00–10:00']);
  });

  it('clicking a day name selects the whole day, and clicking it again clears it', () => {
    const empty = new Set<string>();
    const full = toggleDay(empty, 'Tue');
    expect(full.size).toBe(HOURS.length);
    expect(isDayFull(full, 'Tue')).toBe(true);
    expect(toggleDay(full, 'Tue').size).toBe(0);
  });

  it('a partly selected day becomes fully selected, and other days are untouched', () => {
    const cells = new Set([cellKey('Fri', 10), cellKey('Mon', 8)]);
    const next = toggleDay(cells, 'Fri');
    expect(isDayFull(next, 'Fri')).toBe(true);
    expect(next.has(cellKey('Mon', 8))).toBe(true);
    expect(cells.size).toBe(2); // the original set is not changed
  });

  it('the weekday preset is Monday to Friday, 09:00 to 17:00', () => {
    expect(weekSummary(weekdayHours())).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d) => `${d} 09:00–17:00`));
  });
});
