import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticate = vi.fn();
const insert = vi.fn();
const maybeSingle = vi.fn();
const from = vi.fn();

vi.mock("@/lib/sessions/api", async (original) => ({
  ...(await original<typeof import("@/lib/sessions/api")>()),
  authenticate: (...args: unknown[]) => authenticate(...args),
}));

const { POST } = await import("@/app/api/support-requests/route");

const ME = "a1b2c3d4-0001-4000-8000-000000000001";
const OTHER = "a1b2c3d4-0002-4000-8000-000000000002";

function nextMondayInKL() {
  const klNow = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const daysUntilMonday = (8 - klNow.getUTCDay()) % 7 || 7;
  const monday = new Date(Date.UTC(klNow.getUTCFullYear(), klNow.getUTCMonth(), klNow.getUTCDate() + daysUntilMonday));
  return `${monday.getUTCFullYear()}-${String(monday.getUTCMonth() + 1).padStart(2, "0")}-${String(monday.getUTCDate()).padStart(2, "0")}`;
}

const REQUEST_DATE = nextMondayInKL();
const BODY = {
  title: "Help with programming",
  description: "I need help debugging my assignment.",
  category: "Programming",
  requested_date: REQUEST_DATE,
  requested_time: "15:00",
  support_mode: "Online",
  volunteer_id: OTHER,
  preferred_time: new Date(`${REQUEST_DATE}T15:00:00+08:00`).toISOString(),
};

const post = (body: unknown) => POST(new Request("http://localhost/api/support-requests", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
}));

let volunteerProfileResult: { data: { skills: string[]; is_volunteer: boolean } | null; error: unknown };
let availabilityResult: { data: { day_of_week: string; start_time: string; end_time: string }[] | null; error: unknown };
let profileQuery: { select: ReturnType<typeof vi.fn>; eq: ReturnType<typeof vi.fn>; maybeSingle: typeof maybeSingle };
let availabilityQuery: { select: ReturnType<typeof vi.fn>; eq: ReturnType<typeof vi.fn>; then: (resolve: (value: typeof availabilityResult) => unknown, reject?: (reason: unknown) => unknown) => Promise<unknown> };

beforeEach(() => {
  vi.resetAllMocks();
  volunteerProfileResult = { data: { skills: ["Programming"], is_volunteer: true }, error: null };
  availabilityResult = { data: [{ day_of_week: "Mon", start_time: "14:00", end_time: "17:00" }], error: null };
  profileQuery = { select: vi.fn(), eq: vi.fn(), maybeSingle };
  profileQuery.select.mockReturnValue(profileQuery);
  profileQuery.eq.mockReturnValue(profileQuery);
  maybeSingle.mockImplementation(() => Promise.resolve(volunteerProfileResult));
  availabilityQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    then: (resolve, reject) => Promise.resolve(availabilityResult).then(resolve, reject),
  };
  availabilityQuery.select.mockReturnValue(availabilityQuery);
  availabilityQuery.eq.mockReturnValue(availabilityQuery);
  from.mockImplementation((table: string) => {
    if (table === "volunteer_profile") return profileQuery;
    if (table === "availability") return availabilityQuery;
    if (table === "support_request") return { insert };
    throw new Error(`Unexpected table: ${table}`);
  });
  authenticate.mockResolvedValue({ me: { id: ME }, db: { from } });
  insert.mockResolvedValue({ error: null });
});

describe("POST /api/support-requests", () => {
  it("creates a valid request for an active volunteer with matching skill and availability", async () => {
    const response = await post(BODY);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ success: true });
    expect(from).toHaveBeenCalledWith("volunteer_profile");
    expect(from).toHaveBeenCalledWith("availability");
    expect(insert).toHaveBeenCalledWith({ ...BODY, requester_id: ME, status: "Pending" });
  });

  it("rejects self-assignment before reading or writing requests", async () => {
    const response = await post({ ...BODY, volunteer_id: ME });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: "validation",
      message: "You cannot select yourself as a volunteer.",
      fields: { volunteer_id: "You cannot select yourself as a volunteer." },
    });
    expect(from).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it.each([
    ["missing category", { category: undefined }, "category"],
    ["illegal category", { category: "Unlisted subject" }, "category"],
    ["missing date", { requested_date: undefined }, "requested_date"],
    ["missing time", { requested_time: undefined }, "requested_time"],
    ["unparseable date", { requested_date: "not-a-date" }, "requested_date"],
    ["unparseable time", { requested_time: "25:70" }, "requested_time"],
  ])("rejects %s without inserting", async (_caseName, override, expectedField) => {
    const response = await post({ ...BODY, ...override });
    expect(response.status).toBe(400);
    expect((await response.json()).fields).toHaveProperty(expectedField);
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects a category the selected volunteer does not support", async () => {
    volunteerProfileResult = { data: { skills: ["Database"], is_volunteer: true }, error: null };
    const response = await post(BODY);
    expect(response.status).toBe(400);
    expect((await response.json()).fields).toHaveProperty("category");
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects an inactive or missing volunteer without inserting", async () => {
    volunteerProfileResult = { data: null, error: null };
    const response = await post(BODY);
    expect(response.status).toBe(400);
    expect((await response.json()).fields).toHaveProperty("volunteer_id");
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects a date when the volunteer has no availability on that weekday", async () => {
    availabilityResult = { data: [{ day_of_week: "Tue", start_time: "14:00", end_time: "17:00" }], error: null };
    const response = await post(BODY);
    expect(response.status).toBe(400);
    expect((await response.json()).fields).toHaveProperty("requested_date");
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects a time outside the volunteer's available hours", async () => {
    availabilityResult = { data: [{ day_of_week: "Mon", start_time: "16:00", end_time: "17:00" }], error: null };
    const response = await post(BODY);
    expect(response.status).toBe(400);
    expect((await response.json()).fields).toHaveProperty("requested_time");
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects a preferred timestamp that does not match Kuala Lumpur request date and time", async () => {
    const response = await post({ ...BODY, preferred_time: "2026-10-20T07:00:00.000Z" });
    expect(response.status).toBe(400);
    expect((await response.json()).fields).toHaveProperty("preferred_time");
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects past dates and request times less than one hour away", async () => {
    const pastDate = "2000-01-03";
    const pastResponse = await post({
      ...BODY,
      requested_date: pastDate,
      preferred_time: new Date(`${pastDate}T15:00:00+08:00`).toISOString(),
    });
    expect(pastResponse.status).toBe(400);
    expect((await pastResponse.json()).fields).toHaveProperty("requested_date");

    const soon = new Date(Date.now() + 8 * 60 * 60 * 1000 + 20 * 60 * 1000);
    const soonDate = `${soon.getUTCFullYear()}-${String(soon.getUTCMonth() + 1).padStart(2, "0")}-${String(soon.getUTCDate()).padStart(2, "0")}`;
    const soonTime = `${String(soon.getUTCHours()).padStart(2, "0")}:${String(soon.getUTCMinutes()).padStart(2, "0")}`;
    const soonResponse = await post({
      ...BODY,
      requested_date: soonDate,
      requested_time: soonTime,
      preferred_time: new Date(`${soonDate}T${soonTime}:00+08:00`).toISOString(),
    });
    expect(soonResponse.status).toBe(400);
    expect((await soonResponse.json()).fields).toHaveProperty("requested_time");
    expect(insert).not.toHaveBeenCalled();
  });

  it("translates the database self-volunteer constraint as a validation error", async () => {
    insert.mockResolvedValue({ error: { code: "23514", message: "violates support_request_no_self_volunteer" } });
    const response = await post(BODY);
    expect(response.status).toBe(400);
    expect((await response.json()).message).toBe("You cannot select yourself as a volunteer.");
  });

  it("rejects an unauthenticated caller", async () => {
    authenticate.mockResolvedValueOnce(null);
    const response = await post(BODY);
    expect(response.status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });

  it("ignores client-supplied requester ID and initial status", async () => {
    const response = await post({ ...BODY, requester_id: OTHER, status: "Accepted" });
    expect(response.status).toBe(201);
    expect(insert).toHaveBeenCalledWith({ ...BODY, requester_id: ME, status: "Pending" });
  });

  it("returns a safe error when database insertion fails", async () => {
    insert.mockResolvedValue({ error: { code: "XX000", message: "database unavailable" } });
    const response = await post(BODY);
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: "unknown", message: "We could not submit your support request" });
  });
});
