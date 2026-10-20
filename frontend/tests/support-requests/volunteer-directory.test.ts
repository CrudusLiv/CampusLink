import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadVolunteerDirectory } from "@/lib/support-requests/volunteer-directory";

const SEEKER_ID = "a1b2c3d4-0001-4000-8000-000000000001";
const VOLUNTEER_ONE = "a1b2c3d4-0002-4000-8000-000000000002";
const VOLUNTEER_TWO = "a1b2c3d4-0003-4000-8000-000000000003";

type MockQuery = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  then: Promise<unknown>["then"];
};

function makeQuery(result: unknown): MockQuery {
  const promise = Promise.resolve(result);
  const query = {} as MockQuery;

  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.in = vi.fn(() => query);
  query.then = promise.then.bind(promise);

  return query;
}

describe("volunteer directory data loading", () => {
  let db: Parameters<typeof loadVolunteerDirectory>[0];
  let from: ReturnType<typeof vi.fn>;
  let queries: Record<string, MockQuery>;

  beforeEach(() => {
    queries = {
      volunteer_profile: makeQuery({
        data: [
          { user_id: VOLUNTEER_ONE, skills: ["Programming"] },
          { user_id: VOLUNTEER_TWO, skills: null },
        ],
        error: null,
      }),
      users: makeQuery({
        data: [
          {
            user_id: VOLUNTEER_ONE,
            name: "Alicia Tan",
            photo_url: null,
            faculty: "Computing",
          },
          {
            user_id: VOLUNTEER_TWO,
            name: "Ben Lee",
            photo_url: "https://example.com/ben.png",
            faculty: "Business",
          },
        ],
        error: null,
      }),
      availability: makeQuery({
        data: [
          {
            user_id: VOLUNTEER_ONE,
            day_of_week: "Mon",
            start_time: "10:00:00",
            end_time: "12:00:00",
          },
          {
            user_id: VOLUNTEER_ONE,
            day_of_week: "Wed",
            start_time: "14:00:00",
            end_time: "15:00:00",
          },
        ],
        error: null,
      }),
    };

    from = vi.fn((table: string) => queries[table]);

    db = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: SEEKER_ID } },
          error: null,
        }),
      },
      from,
    } as unknown as Parameters<typeof loadVolunteerDirectory>[0];
  });

  it("loads active volunteers and joins their profiles and availability", async () => {
    const result = await loadVolunteerDirectory(db);

    expect(result.error).toBeNull();
    expect(result.currentUserId).toBe(SEEKER_ID);
    expect(result.volunteers).toEqual([
      {
        user_id: VOLUNTEER_ONE,
        name: "Alicia Tan",
        photo_url: null,
        faculty: "Computing",
        skills: ["Programming"],
        availability: [
          { day: "Mon", start: "10:00:00", end: "12:00:00" },
          { day: "Wed", start: "14:00:00", end: "15:00:00" },
        ],
      },
      {
        user_id: VOLUNTEER_TWO,
        name: "Ben Lee",
        photo_url: "https://example.com/ben.png",
        faculty: "Business",
        skills: [],
        availability: [],
      },
    ]);

    expect(from).toHaveBeenNthCalledWith(1, "volunteer_profile");
    expect(queries.volunteer_profile.eq).toHaveBeenCalledWith(
      "is_volunteer",
      true,
    );
    expect(queries.users.in).toHaveBeenCalledWith("user_id", [
      VOLUNTEER_ONE,
      VOLUNTEER_TWO,
    ]);
    expect(queries.availability.in).toHaveBeenCalledWith("user_id", [
      VOLUNTEER_ONE,
      VOLUNTEER_TWO,
    ]);
  });

  it("returns the volunteer-list error and skips detail queries when that query fails", async () => {
    queries.volunteer_profile = makeQuery({
      data: null,
      error: { message: "query failed" },
    });

    const result = await loadVolunteerDirectory(db);

    expect(result.error).toBe("volunteer-list");
    expect(result.volunteers).toEqual([]);
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("returns the volunteer-details error when a profile query fails", async () => {
    queries.users = makeQuery({
      data: null,
      error: { message: "profile query failed" },
    });

    const result = await loadVolunteerDirectory(db);

    expect(result.error).toBe("volunteer-details");
    expect(result.volunteers).toEqual([]);
    expect(from).toHaveBeenCalledTimes(3);
  });
});