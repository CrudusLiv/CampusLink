import { describe, expect, it } from "vitest";
import { matchesVolunteerSkillAndFaculty } from "@/lib/support-requests/volunteer-search";

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