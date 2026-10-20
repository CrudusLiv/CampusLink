import { describe, expect, it } from "vitest";
import { matchesWeeklyAvailability } from "@/lib/support-requests/volunteer-search";

describe("TCUC2_13 weekly availability matching", () => {
  const availability = [
    { day: "Mon", start: "10:00:00", end: "12:00:00" },
    { day: "Tue", start: "13:00:00", end: "15:00:00" },
  ];

  it.each([
    ["matches the slot start time", "Mon", "10:00", true],
    ["matches a time inside the slot", "Mon", "11:59", true],
    ["does not match the slot end time", "Mon", "12:00", false],
    ["does not match a different day", "Wed", "11:00", false],
  ])("%s", (_caseName, day, time, expected) => {
    expect(matchesWeeklyAvailability(availability, day, time)).toBe(expected);
  });

  it("matches any available time on the selected day when no time is provided", () => {
    expect(matchesWeeklyAvailability(availability, "Mon", "")).toBe(true);
  });

  it("does not filter by availability when no day is selected", () => {
    expect(matchesWeeklyAvailability(availability, "", "11:00")).toBe(true);
  });
});