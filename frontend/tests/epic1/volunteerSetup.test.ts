// Unit tests – Skills & Availability rules (User Story 2)
import { describe, expect, it } from "vitest";
import { DAYS } from "../../lib/categories";
import {
  MAX_SUBJECT_LENGTH,
  cellKey,
  cellsToSlots,
  normaliseSubject,
  setupSignature,
  validateNewSubject,
  validateVolunteerSetup,
} from "../../lib/validation/volunteerSetup";

const day1 = DAYS[0];
const day2 = DAYS[1];

describe("validateVolunteerSetup", () => {
  it("UT-E1-22 passes with at least one subject and one time slot", () => {
    expect(validateVolunteerSetup(["Programming"], new Set([cellKey(day1, 10)]))).toEqual({});
  });

  it("UT-E1-23 asks for a subject when none is chosen", () => {
    expect(validateVolunteerSetup([], new Set([cellKey(day1, 10)])).skills).toBe("Choose at least one subject tag.");
  });

  it("UT-E1-24 asks for a time slot when none is chosen", () => {
    expect(validateVolunteerSetup(["Programming"], new Set()).slots).toBe("Choose at least one time slot.");
  });
});

describe("cellsToSlots", () => {
  it("UT-E1-25 joins back-to-back hours into one time range", () => {
    const cells = new Set([cellKey(day1, 10), cellKey(day1, 11)]);
    expect(cellsToSlots(cells)).toEqual([{ day_of_week: day1, start_time: "10:00", end_time: "12:00" }]);
  });

  it("UT-E1-26 keeps hours with a gap as separate ranges", () => {
    const cells = new Set([cellKey(day1, 8), cellKey(day1, 10)]);
    expect(cellsToSlots(cells)).toHaveLength(2);
  });

  it("UT-E1-27 keeps different days separate", () => {
    const cells = new Set([cellKey(day1, 9), cellKey(day2, 9)]);
    expect(cellsToSlots(cells).map((s) => s.day_of_week)).toEqual([day1, day2]);
  });

  it("UT-E1-28 returns no slots when nothing is selected", () => {
    expect(cellsToSlots(new Set())).toEqual([]);
  });
});

describe("validateNewSubject", () => {
  it("UT-E1-29 accepts a new subject", () => {
    expect(validateNewSubject("Accounting", ["Programming"])).toBe("");
  });

  it("UT-E1-30 rejects an empty subject", () => {
    expect(validateNewSubject("   ", [])).toBe("Type a subject first.");
  });

  it("UT-E1-31 rejects a subject that is too long", () => {
    expect(validateNewSubject("a".repeat(MAX_SUBJECT_LENGTH + 1), [])).not.toBe("");
  });

  it("UT-E1-32 rejects a duplicate subject in a different case", () => {
    expect(validateNewSubject("programming", ["Programming"])).toBe("You've already added this subject.");
  });
});

describe("normaliseSubject", () => {
  it("UT-E1-33 reuses the list's spelling for a matching subject", () => {
    expect(normaliseSubject("  database ", ["Database"])).toBe("Database");
  });

  it("UT-E1-34 tidies extra spaces in a new subject", () => {
    expect(normaliseSubject("  Data   Science ", ["Database"])).toBe("Data Science");
  });
});

describe("setupSignature", () => {
  it("UT-E1-35 is the same when the choices are the same in a different order", () => {
    const a = setupSignature(["Maths", "Programming"], new Set([cellKey(day1, 9), cellKey(day2, 10)]));
    const b = setupSignature(["Programming", "Maths"], new Set([cellKey(day2, 10), cellKey(day1, 9)]));
    expect(a).toBe(b);
  });

  it("UT-E1-36 changes when a time slot is added", () => {
    const before = setupSignature(["Maths"], new Set([cellKey(day1, 9)]));
    const after = setupSignature(["Maths"], new Set([cellKey(day1, 9), cellKey(day1, 10)]));
    expect(after).not.toBe(before);
  });
});
