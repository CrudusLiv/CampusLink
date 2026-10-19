import { describe, expect, it } from "vitest";
import { matchesVolunteerSearch } from "@/lib/support-requests/volunteer-search";

const volunteer = {
  name: "Alicia Tan",
  faculty: "Computing",
  skills: ["Programming", "Database"],
};

describe("TCUC2_11 volunteer search", () => {
  it.each([
    ["name", "alicia"],
    ["faculty", "COMPUTING"],
    ["skill", "database"],
  ])("matches a query by %s", (_field, query) => {
    expect(matchesVolunteerSearch(volunteer, query)).toBe(true);
  });

  it("does not match when the query is absent from the name, faculty, and skills", () => {
    expect(matchesVolunteerSearch(volunteer, "Mathematics")).toBe(false);
  });

  it("matches all volunteers when the search query is blank", () => {
    expect(matchesVolunteerSearch(volunteer, "   ")).toBe(true);
  });
});