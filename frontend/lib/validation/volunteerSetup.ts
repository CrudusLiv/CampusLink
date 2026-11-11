// Skills & Availability rules (Epic 1 – User Story 2).
// Kept outside the page so the rules can be unit tested with Vitest.

import { DAYS, Day } from "../categories";

// One-hour slots from 08:00 to 21:00
export const HOURS = Array.from({ length: 13 }, (_, i) => 8 + i);

export type Slot = { day_of_week: Day; start_time: string; end_time: string };

export function cellKey(day: Day, hour: number) {
  return `${day}-${hour}`;
}

export function toTime(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

export const MAX_SUBJECT_LENGTH = 40;

// Tidies a typed subject: trims spaces and reuses the list's spelling if it already exists,
// so "database" and "Database" count as the same subject.
export function normaliseSubject(input: string, existing: string[]) {
  const cleaned = input.trim().replace(/\s+/g, " ");
  const match = existing.find((s) => s.toLowerCase() === cleaned.toLowerCase());
  return match ?? cleaned;
}

export function validateNewSubject(input: string, skills: string[]) {
  const cleaned = input.trim();
  if (cleaned === "") return "Type a subject first.";
  if (cleaned.length > MAX_SUBJECT_LENGTH) return `Keep it under ${MAX_SUBJECT_LENGTH} characters.`;
  if (skills.some((s) => s.toLowerCase() === cleaned.toLowerCase())) return "You've already added this subject.";
  return "";
}

// A short "fingerprint" of the choices, used to tell if anything changed since the last save
export function setupSignature(skills: string[], cells: Set<string>) {
  return JSON.stringify([[...skills].sort(), [...cells].sort()]);
}

export function validateVolunteerSetup(skills: string[], cells: Set<string>) {
  const errors: { skills?: string; slots?: string } = {};
  if (skills.length === 0) {
    errors.skills = "Choose at least one subject tag.";
  }
  if (cells.size === 0) {
    errors.slots = "Choose at least one time slot.";
  }
  return errors;
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
