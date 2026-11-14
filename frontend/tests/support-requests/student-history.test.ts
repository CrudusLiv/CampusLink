import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadStudentSupportHistory } from "@/lib/support-requests/student-history";

const STUDENT_ID = "a1b2c3d4-0001-4000-8000-000000000001";
const VOLUNTEER_ID = "a1b2c3d4-0002-4000-8000-000000000002";
const REQUEST_ID = "a1b2c3d4-0003-4000-8000-000000000003";
const SESSION_ID = "a1b2c3d4-0004-4000-8000-000000000004";

function makeQuery(result: unknown) {
  const promise = Promise.resolve(result);
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    then: promise.then.bind(promise),
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.order.mockReturnValue(query);

  return query;
}

describe("TCUC2_31 loads student support request history", () => {
  let requestQuery: ReturnType<typeof makeQuery>;
  let volunteerQuery: ReturnType<typeof makeQuery>;
  let db: Parameters<typeof loadStudentSupportHistory>[0];

  beforeEach(() => {
    requestQuery = makeQuery({
      data: [{
        request_id: REQUEST_ID,
        title: "Programming support",
        category: "Programming",
        requested_date: "2026-10-26",
        volunteer_id: VOLUNTEER_ID,
        status: "Completed",
      }],
      error: null,
    });
    volunteerQuery = makeQuery({
      data: [{ user_id: VOLUNTEER_ID, name: "Test Volunteer" }],
      error: null,
    });
    db = {
      from: vi.fn((table: string) => table === "support_request" ? requestQuery : volunteerQuery),
    } as unknown as Parameters<typeof loadStudentSupportHistory>[0];
  });

  it("loads the student's records and joins the volunteer name", async () => {
    const result = await loadStudentSupportHistory(db, STUDENT_ID);

    expect(requestQuery.eq).toHaveBeenCalledWith("requester_id", STUDENT_ID);
    expect(requestQuery.in).toHaveBeenCalledWith("status", [
      "Pending", "Accepted", "Completed", "Cancelled", "Declined",
    ]);
    expect(requestQuery.order).toHaveBeenCalledWith("requested_date", {
      ascending: false,
    });
    expect(result.error).toBeNull();
    expect(result.rows).toEqual([{
      id: REQUEST_ID,
      title: "Programming support",
      category: "Programming",
      requested_date: "2026-10-26",
      volunteer_id: VOLUNTEER_ID,
      volunteer_name: "Test Volunteer",
      status: "Completed",
      rating: null,
      session_id: null,
    }]);
  });
});

describe("TCUC2_32 shows ratings and session links in history", () => {
  it("shows an existing rating and retains the session link when unrated", async () => {
    const requestQuery = makeQuery({
      data: [{
        request_id: REQUEST_ID,
        title: "Programming support",
        category: "Programming",
        requested_date: "2026-10-26",
        volunteer_id: VOLUNTEER_ID,
        status: "Completed",
      }],
      error: null,
    });
    const volunteerQuery = makeQuery({
      data: [{ user_id: VOLUNTEER_ID, name: "Test Volunteer" }],
      error: null,
    });
    const makeDb = (feedback: unknown) => ({
      from: vi.fn((table: string) => {
        if (table === "support_request") return requestQuery;
        if (table === "users") return volunteerQuery;
        if (table === "session") return makeQuery({ data: [{ session_id: SESSION_ID, request_id: REQUEST_ID }], error: null });
        return makeQuery(feedback);
      }),
    }) as unknown as Parameters<typeof loadStudentSupportHistory>[0];

    const rated = await loadStudentSupportHistory(makeDb({
      data: [{ session_id: SESSION_ID, rating: 4 }], error: null,
    }), STUDENT_ID);
    expect(rated.rows[0]).toMatchObject({ session_id: SESSION_ID, rating: 4 });

    const unrated = await loadStudentSupportHistory(makeDb({ data: [], error: null }), STUDENT_ID);
    expect(unrated.rows[0]).toMatchObject({ session_id: SESSION_ID, rating: null });
  });
});

describe("TCUC2_33 maps each history record to its volunteer name", () => {
  it("associates volunteer names with the matching volunteer IDs", async () => {
    const secondVolunteerId = "a1b2c3d4-0002-4000-8000-000000000005";
    const secondRequestId = "a1b2c3d4-0003-4000-8000-000000000006";
    const requestQuery = makeQuery({
      data: [
        { request_id: REQUEST_ID, title: "First request", category: "Programming", requested_date: "2026-10-26", volunteer_id: VOLUNTEER_ID, status: "Completed" },
        { request_id: secondRequestId, title: "Second request", category: "Math", requested_date: "2026-10-25", volunteer_id: secondVolunteerId, status: "Completed" },
      ],
      error: null,
    });
    const volunteerQuery = makeQuery({
      data: [
        { user_id: secondVolunteerId, name: "Second Volunteer" },
        { user_id: VOLUNTEER_ID, name: "First Volunteer" },
      ],
      error: null,
    });
    const emptyQuery = makeQuery({ data: [], error: null });
    const db = {
      from: vi.fn((table: string) => table === "support_request" ? requestQuery : table === "users" ? volunteerQuery : emptyQuery),
    } as unknown as Parameters<typeof loadStudentSupportHistory>[0];

    const result = await loadStudentSupportHistory(db, STUDENT_ID);

    expect(result.rows.map(({ id, volunteer_name }) => ({ id, volunteer_name }))).toEqual([
      { id: REQUEST_ID, volunteer_name: "First Volunteer" },
      { id: secondRequestId, volunteer_name: "Second Volunteer" },
    ]);
    expect(volunteerQuery.in).toHaveBeenCalledWith("user_id", [VOLUNTEER_ID, secondVolunteerId]);
  });
});

describe("TCUC2_34 handles support request history query failures", () => {
  it("returns empty rows and the history error when the query fails", async () => {
    const failedQuery = makeQuery({
      data: null,
      error: { message: "Database unavailable" },
    });
    const db = {
      from: vi.fn(() => failedQuery),
    } as unknown as Parameters<typeof loadStudentSupportHistory>[0];

    const result = await loadStudentSupportHistory(db, STUDENT_ID);

    expect(result).toEqual({ rows: [], error: "history" });
    expect(db.from).toHaveBeenCalledTimes(1);
  });
});
