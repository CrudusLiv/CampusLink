import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadVolunteerRequests } from "@/lib/support-requests/volunteer-requests";

const VOLUNTEER_ID = "a1b2c3d4-0002-4000-8000-000000000002";
const REQUEST_ID = "a1b2c3d4-0003-4000-8000-000000000003";
const REQUESTER_ID = "a1b2c3d4-0001-4000-8000-000000000001";

type MockQuery = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  then: Promise<unknown>["then"];
};

function makeQuery(result: unknown): MockQuery {
  const promise = Promise.resolve(result);
  const query = {} as MockQuery;
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.in = vi.fn(() => query);
  query.order = vi.fn(() => query);
  query.then = promise.then.bind(promise);
  return query;
}

describe("TCUC2_32 loads only the volunteer's pending requests", () => {
  let db: Parameters<typeof loadVolunteerRequests>[0];
  let requestQuery: MockQuery;
  let requesterQuery: MockQuery;
  let from: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    requestQuery = makeQuery({
      data: [{
        request_id: REQUEST_ID,
        title: "Programming support",
        category: "Programming",
        requested_date: "2026-10-26",
        requested_time: "10:00:00",
        support_mode: "Online",
        requester_id: REQUESTER_ID,
        status: "Pending",
      }],
      error: null,
    });
    requesterQuery = makeQuery({
      data: [{ user_id: REQUESTER_ID, name: "Test Student" }],
      error: null,
    });
    from = vi.fn((table: string) => table === "support_request" ? requestQuery : requesterQuery);
    db = { from } as unknown as Parameters<typeof loadVolunteerRequests>[0];
  });

  it("filters requests by volunteer ID and Pending status, then joins the requester name", async () => {
    const result = await loadVolunteerRequests(db, "incoming", VOLUNTEER_ID);

    expect(requestQuery.eq).toHaveBeenCalledWith("volunteer_id", VOLUNTEER_ID);
    expect(requestQuery.in).toHaveBeenCalledWith("status", ["Pending"]);
    expect(result.error).toBeNull();
    expect(result.items).toEqual([{
      id: REQUEST_ID,
      title: "Programming support",
      category: "Programming",
      requested_date: "2026-10-26",
      requested_time: "10:00:00",
      support_mode: "Online",
      requester_id: REQUESTER_ID,
      requester_name: "Test Student",
      status: "Pending",
    }]);
  });

  it("TCUC2_39 loads the volunteer's support request history", async () => {
    const result = await loadVolunteerRequests(db, "history", VOLUNTEER_ID);

    expect(requestQuery.eq).toHaveBeenCalledWith("volunteer_id", VOLUNTEER_ID);
    expect(requestQuery.in).toHaveBeenCalledWith("status", [
      "Pending",
      "Accepted",
      "Completed",
      "Cancelled",
      "Declined",
    ]);
    expect(result.error).toBeNull();
    expect(result.items[0].requester_name).toBe("Test Student");
  });
});
