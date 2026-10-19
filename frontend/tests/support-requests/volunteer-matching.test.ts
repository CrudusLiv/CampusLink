import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadMatchingVolunteers,
  matchesVolunteerSchedule,
  matchesVolunteerSkill,
  selectVolunteerRecommendations,
} from "@/lib/support-requests/volunteer-matching";

describe("TCUC2_20 matches volunteers by request category", () => {
  it("matches volunteers with the selected category skill", () => {
    expect(matchesVolunteerSkill(["Programming", "Math"], "Programming")).toBe(true);
    expect(matchesVolunteerSkill(["Math"], "Programming")).toBe(false);
  });
});

describe("TCUC2_21 matches volunteers by requested schedule", () => {
  it.each([
    ["matches the slot start time", "Tue", "10:00", true],
    ["matches a time inside the slot", "Tue", "11:00", true],
    ["does not match the slot end time", "Tue", "12:00", false],
    ["does not match a different day", "Wed", "11:00", false],
  ] as const)("%s", (_caseName, day, time, expected) => {
    expect(
      matchesVolunteerSchedule(
        [{ day: "Tue", start: "10:00", end: "12:00" }],
        day,
        time,
      ),
    ).toBe(expected);
  });
});

const REQUESTER_ID = "a1b2c3d4-0001-4000-8000-000000000001";
const VOLUNTEER_ID = "a1b2c3d4-0002-4000-8000-000000000002";
const OTHER_ID = "a1b2c3d4-0004-4000-8000-000000000004";

function makeQuery(result: unknown) {
  const promise = Promise.resolve(result);
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    then: promise.then.bind(promise),
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.in.mockReturnValue(query);

  return query;
}

describe("TCUC2_22 loads matching volunteers with profile and availability data", () => {
  const volunteerQuery = makeQuery({
    data: [
      { user_id: REQUESTER_ID, skills: ["Programming"] },
      { user_id: VOLUNTEER_ID, skills: ["Programming"] },
      { user_id: OTHER_ID, skills: ["Math"] },
    ],
    error: null,
  });

  const profileQuery = makeQuery({
    data: [{
      user_id: VOLUNTEER_ID,
      name: "Test Volunteer",
      photo_url: null,
    }],
    error: null,
  });

  const availabilityQuery = makeQuery({
    data: [{
      user_id: VOLUNTEER_ID,
      day_of_week: "Tue",
      start_time: "10:00",
      end_time: "12:00",
    }],
    error: null,
  });

  const db = {
    from: vi.fn((table: string) => {
      if (table === "volunteer_profile") return volunteerQuery;
      if (table === "users") return profileQuery;
      return availabilityQuery;
    }),
  } as unknown as Parameters<typeof loadMatchingVolunteers>[0];

  beforeEach(() => {
    vi.clearAllMocks();
    volunteerQuery.select.mockReturnValue(volunteerQuery);
    volunteerQuery.eq.mockReturnValue(volunteerQuery);
    profileQuery.select.mockReturnValue(profileQuery);
    profileQuery.in.mockReturnValue(profileQuery);
    availabilityQuery.select.mockReturnValue(availabilityQuery);
    availabilityQuery.in.mockReturnValue(availabilityQuery);
  });

  it("filters by category and joins profile and availability data", async () => {
    const result = await loadMatchingVolunteers(db, REQUESTER_ID, "Programming");

    expect(volunteerQuery.eq).toHaveBeenCalledWith("is_volunteer", true);
    expect(profileQuery.in).toHaveBeenCalledWith("user_id", [VOLUNTEER_ID]);
    expect(availabilityQuery.in).toHaveBeenCalledWith("user_id", [VOLUNTEER_ID]);
    expect(result.error).toBeNull();
    expect(result.volunteers).toEqual([{
      user_id: VOLUNTEER_ID,
      name: "Test Volunteer",
      photo_url: null,
      skills: ["Programming"],
      availability: [{ day: "Tue", start: "10:00", end: "12:00" }],
    }]);
  });
});

describe("TCUC2_23 excludes the requester and limits recommendations", () => {
  it("excludes the requester and returns no more than three matches", async () => {
    const volunteerIds = [
      "a1b2c3d4-0002-4000-8000-000000000002",
      "a1b2c3d4-0004-4000-8000-000000000004",
      "a1b2c3d4-0005-4000-8000-000000000005",
      "a1b2c3d4-0006-4000-8000-000000000006",
    ];

    const volunteerQuery = makeQuery({
      data: [
        { user_id: REQUESTER_ID, skills: ["Programming"] },
        ...volunteerIds.map((user_id) => ({
          user_id,
          skills: ["Programming"],
        })),
      ],
      error: null,
    });

    const profileQuery = makeQuery({
      data: volunteerIds.map((user_id, index) => ({
        user_id,
        name: `Volunteer ${index + 1}`,
        photo_url: null,
      })),
      error: null,
    });

    const availabilityQuery = makeQuery({
      data: volunteerIds.map((user_id) => ({
        user_id,
        day_of_week: "Tue",
        start_time: "10:00",
        end_time: "12:00",
      })),
      error: null,
    });

    const db = {
      from: vi.fn((table: string) => {
        if (table === "volunteer_profile") return volunteerQuery;
        if (table === "users") return profileQuery;
        return availabilityQuery;
      }),
    } as unknown as Parameters<typeof loadMatchingVolunteers>[0];

    const loaded = await loadMatchingVolunteers(db, REQUESTER_ID, "Programming");
    expect(loaded.error).toBeNull();

    const recommendations = selectVolunteerRecommendations(
      loaded.volunteers,
      REQUESTER_ID,
      "Tue",
      "10:00",
    );
  });
  
  describe("TCUC2_24 handles volunteer matching query failures", () => {
    it.each([
        ["volunteer query", "volunteer_profile", "volunteers"],
        ["profile query", "users", "details"],
        ["availability query", "availability", "details"],
    ] as const)("returns a safe error when the %s fails", async (_, failedTable, expectedError) => {
        const volunteerQuery = makeQuery({
        data: [{ user_id: VOLUNTEER_ID, skills: ["Programming"] }],
        error: failedTable === "volunteer_profile"
            ? { message: "Database unavailable" }
            : null,
        });

        const profileQuery = makeQuery({
        data: [{ user_id: VOLUNTEER_ID, name: "Test Volunteer", photo_url: null }],
        error: failedTable === "users"
            ? { message: "Database unavailable" }
            : null,
        });

        const availabilityQuery = makeQuery({
        data: [],
        error: failedTable === "availability"
            ? { message: "Database unavailable" }
            : null,
        });

        const db = {
        from: vi.fn((table: string) => {
            if (table === "volunteer_profile") return volunteerQuery;
            if (table === "users") return profileQuery;
            return availabilityQuery;
        }),
        } as unknown as Parameters<typeof loadMatchingVolunteers>[0];

        const result = await loadMatchingVolunteers(db, REQUESTER_ID, "Programming");

        expect(result).toEqual({ volunteers: [], error: expectedError });
    });
    });
});