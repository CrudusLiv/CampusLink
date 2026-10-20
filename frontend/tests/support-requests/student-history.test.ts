import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadStudentSupportHistory } from "@/lib/support-requests/student-history";

const STUDENT_ID = "a1b2c3d4-0001-4000-8000-000000000001";
const VOLUNTEER_ID = "a1b2c3d4-0002-4000-8000-000000000002";
const REQUEST_ID = "a1b2c3d4-0003-4000-8000-000000000003";

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

describe("TCUC2_38 loads the student's support request history", () => {
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
      from: vi.fn((table: string) =>
        table === "support_request" ? requestQuery : volunteerQuery,
      ),
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
    }]);
  });

  it("TCUC2_40 includes the other participant's name in history records", async () => {
     const result = await loadStudentSupportHistory(db, STUDENT_ID);

    expect(result.error).toBeNull();
    expect(result.rows[0].volunteer_name).toBe("Test Volunteer");
    });

    it("TCUC2_41 handles a request history query failure", async () => {
        const failedQuery = makeQuery({
            data: null,
            error: { message: "Database unavailable" },
        });

        const failingDb = {
            from: vi.fn(() => failedQuery),
        } as unknown as Parameters<typeof loadStudentSupportHistory>[0];

        const result = await loadStudentSupportHistory(failingDb, STUDENT_ID);

        expect(result).toEqual({ rows: [], error: "history" });
        expect(failingDb.from).toHaveBeenCalledTimes(1);
    });
});