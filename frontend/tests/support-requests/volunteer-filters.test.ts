import { describe, expect, it } from "vitest";
import { matchesVolunteerSkillAndFaculty, matchesVolunteerSupportMode } from "@/lib/support-requests/volunteer-search";

describe("TCUC2_12 skill and faculty filters", () => {
  const volunteers = [
    { user_id: "both", skills: ["Programming"], faculty: "Computing" },
    { user_id: "skill-only", skills: ["Programming"], faculty: "Business" },
    { user_id: "faculty-only", skills: ["Writing"], faculty: "Computing" },
    { user_id: "neither", skills: ["Writing"], faculty: "Business" },
  ];

  it("keeps only volunteers matching both selected filters", () => {
    const result = volunteers.filter((volunteer) =>
      matchesVolunteerSkillAndFaculty(volunteer, "Programming", "Computing")
    );

    expect(result.map((volunteer) => volunteer.user_id)).toEqual(["both"]);
  });

  it("keeps all matching volunteers when both filters are cleared", () => {
    const result = volunteers.filter((volunteer) =>
      matchesVolunteerSkillAndFaculty(volunteer, "", "")
    );

    expect(result).toHaveLength(4);
  });
});

describe("volunteer support mode filter", () => {
  it("matches the volunteer-provided mode, with Both satisfying either option", () => {
    expect(matchesVolunteerSupportMode("Online", "Online")).toBe(true);
    expect(matchesVolunteerSupportMode("Online", "In-person")).toBe(false);
    expect(matchesVolunteerSupportMode("In-person", "In-person")).toBe(true);
    expect(matchesVolunteerSupportMode("Both", "Online")).toBe(true);
    expect(matchesVolunteerSupportMode("Both", "In-person")).toBe(true);
    expect(matchesVolunteerSupportMode("Online", "")).toBe(true);
  });
});
