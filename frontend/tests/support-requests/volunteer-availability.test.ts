import { describe, expect, it } from "vitest";
import { matchesWeeklyAvailability } from "@/lib/support-requests/volunteer-search";

describe("TCUC2_13 weekly availability matching", () => {
  const availability = [
    { day: "Mon", start: "10:00:00", end: "12:00:00" },
    { day: "Tue", start: "13:00:00", end: "15:00:00" },
  ];

  it.each([
    ["matches at the slot start", "Mon", "10:00", true],
    ["matches when the booking ends at the slot end", "Mon", "11:00", true],
    ["does not match when the booking exceeds the slot by one minute", "Mon", "11:01", false],
    ["does not match at the slot end", "Mon", "12:00", false],
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
