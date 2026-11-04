// Pure helpers for the weekly availability grid on the Skills & Availability page (no browser or database needed).
import { DAYS, type Day } from "./categories";

// One-hour slots from 08:00 to 21:00
export const HOURS = Array.from({ length: 13 }, (_, i) => 8 + i);

export type Slot = { day_of_week: Day; start_time: string; end_time: string };

export function cellKey(day: Day, hour: number) {
  return `${day}-${hour}`;
}

export function toTime(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

// Turns selected hour cells into time ranges, e.g. Mon 10, 11 → Mon 10:00–12:00
export function cellsToSlots(cells: Set<string>): Slot[] {
  const slots: Slot[] = [];
  for (const day of DAYS) {
    const hours = HOURS.filter((h) => cells.has(cellKey(day, h)));
    let i = 0;
    while (i < hours.length) {
      const start = hours[i];
      // Walk forward while the hours are back-to-back
      while (i + 1 < hours.length && hours[i + 1] === hours[i] + 1) i++;
      slots.push({ day_of_week: day, start_time: toTime(start), end_time: toTime(hours[i] + 1) });
      i++;
    }
  }
  return slots;
}

/** Is every hour of this day selected? */
export function isDayFull(cells: Set<string>, day: Day) {
  return HOURS.every((h) => cells.has(cellKey(day, h)));
}

/** Click on a day name: select the whole day, or clear it if it is already fully selected. */
export function toggleDay(cells: Set<string>, day: Day): Set<string> {
  const next = new Set(cells);
  const full = isDayFull(cells, day);
  for (const h of HOURS) {
    if (full) next.delete(cellKey(day, h));
    else next.add(cellKey(day, h));
  }
  return next;
}

/** A common starting point: Monday to Friday, 09:00 to 17:00. Replaces whatever was selected. */
export function weekdayHours(): Set<string> {
  const next = new Set<string>();
  for (const day of DAYS.slice(0, 5)) {
    for (const h of HOURS) if (h >= 9 && h < 17) next.add(cellKey(day, h));
  }
  return next;
}

/** One short line per run of hours, e.g. "Mon 08:00–12:00", for the "your week" summary. */
export function weekSummary(cells: Set<string>): string[] {
  return cellsToSlots(cells).map((s) => `${s.day_of_week} ${s.start_time}–${s.end_time}`);
}
