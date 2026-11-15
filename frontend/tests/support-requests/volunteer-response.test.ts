import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveVolunteerResponse } from "@/lib/support-requests/volunteer-requests";

const REQUEST_ID = "a1b2c3d4-0003-4000-8000-000000000003";
const VOLUNTEER_ID = "a1b2c3d4-0002-4000-8000-000000000002";

function makeQuery() {
  const query = {
    update: vi.fn(),
    eq: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn(),
  };

  query.update.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.select.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({
    data: { request_id: REQUEST_ID },
    error: null,
  });

  return query;
}

describe("TCUC2_26 saves an accepted response", () => {
  let query: ReturnType<typeof makeQuery>;
  let db: Parameters<typeof saveVolunteerResponse>[0];

  beforeEach(() => {
    query = makeQuery();
    db = {
      from: vi.fn(() => query),
    } as unknown as Parameters<typeof saveVolunteerResponse>[0];
  });

  it("updates the volunteer's pending request to Accepted", async () => {
    const result = await saveVolunteerResponse(
      db,
      REQUEST_ID,
      VOLUNTEER_ID,
      "Accepted",
    );

    expect(db.from).toHaveBeenCalledWith("support_request");
    expect(query.update).toHaveBeenCalledWith({ status: "Accepted" });
    expect(query.eq).toHaveBeenCalledWith("request_id", REQUEST_ID);
    expect(query.eq).toHaveBeenCalledWith("volunteer_id", VOLUNTEER_ID);
    expect(query.eq).toHaveBeenCalledWith("status", "Pending");
    expect(result.saved).toBe(true);
  });
});

describe("TCUC2_27 saves a declined response", () => {
  let query: ReturnType<typeof makeQuery>;
  let db: Parameters<typeof saveVolunteerResponse>[0];

  beforeEach(() => {
    query = makeQuery();
    db = {
      from: vi.fn(() => query),
    } as unknown as Parameters<typeof saveVolunteerResponse>[0];
  });

  it("updates the volunteer's pending request to Declined", async () => {
    const result = await saveVolunteerResponse(
        db,
        REQUEST_ID,
        VOLUNTEER_ID,
        "Declined",
    );

    expect(query.update).toHaveBeenCalledWith({ status: "Declined" });
    expect(query.eq).toHaveBeenCalledWith("request_id", REQUEST_ID);
    expect(query.eq).toHaveBeenCalledWith("volunteer_id", VOLUNTEER_ID);
    expect(query.eq).toHaveBeenCalledWith("status", "Pending");
    expect(result.saved).toBe(true);
    });
});

describe("TCUC2_28 Handle a failed response update", () => {
  let query: ReturnType<typeof makeQuery>;
  let db: Parameters<typeof saveVolunteerResponse>[0];

  beforeEach(() => {
    query = makeQuery();
    db = {
      from: vi.fn(() => query),
    } as unknown as Parameters<typeof saveVolunteerResponse>[0];
  });

  it("returns failure when the response update fails", async () => {
    query.maybeSingle.mockResolvedValue({
        data: null,
        error: { message: "Database unavailable" },
    });

    const result = await saveVolunteerResponse(
        db,
        REQUEST_ID,
        VOLUNTEER_ID,
        "Accepted",
    );

    expect(result.saved).toBe(false);
    });
});

describe("TCUC2_47 updates support request status", () => {
  let query: ReturnType<typeof makeQuery>;
  let db: Parameters<typeof saveVolunteerResponse>[0];

  beforeEach(() => {
    query = makeQuery();
    db = {
      from: vi.fn(() => query),
    } as unknown as Parameters<typeof saveVolunteerResponse>[0];
  });

  it("TCUC2_47 updates Pending to Accepted when volunteer accepts", async () => {
    const result = await saveVolunteerResponse(
      db,
      REQUEST_ID,
      VOLUNTEER_ID,
      "Accepted",
    );

    expect(db.from).toHaveBeenCalledWith("support_request");
    expect(query.update).toHaveBeenCalledWith({ status: "Accepted" });
    expect(query.eq).toHaveBeenCalledWith("request_id", REQUEST_ID);
    expect(query.eq).toHaveBeenCalledWith("volunteer_id", VOLUNTEER_ID);
    expect(query.eq).toHaveBeenCalledWith("status", "Pending");
    expect(result.saved).toBe(true);
  });
});

describe("TCUC2_48 updates support request status", () => {
  let query: ReturnType<typeof makeQuery>;
  let db: Parameters<typeof saveVolunteerResponse>[0];

  beforeEach(() => {
    query = makeQuery();
    db = {
      from: vi.fn(() => query),
    } as unknown as Parameters<typeof saveVolunteerResponse>[0];
  });

  it("TCUC2_48 updates Pending to Declined when volunteer declines", async () => {
    const result = await saveVolunteerResponse(
      db,
      REQUEST_ID,
      VOLUNTEER_ID,
      "Declined",
    );

    expect(query.update).toHaveBeenCalledWith({ status: "Declined" });
    expect(query.eq).toHaveBeenCalledWith("request_id", REQUEST_ID);
    expect(query.eq).toHaveBeenCalledWith("volunteer_id", VOLUNTEER_ID);
    expect(query.eq).toHaveBeenCalledWith("status", "Pending");
    expect(result.saved).toBe(true);
  });
});

describe("TCUC2_49 handles database update failure", () => {
  let query: ReturnType<typeof makeQuery>;
  let db: Parameters<typeof saveVolunteerResponse>[0];

  beforeEach(() => {
    query = makeQuery();
    db = {
      from: vi.fn(() => query),
    } as unknown as Parameters<typeof saveVolunteerResponse>[0];
  });

  it("TCUC2_49 returns saved false when the database update fails", async () => {
    query.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: "Database unavailable" },
    });

    const result = await saveVolunteerResponse(
      db,
      REQUEST_ID,
      VOLUNTEER_ID,
      "Accepted",
    );

    expect(result.saved).toBe(false);
  });
});
