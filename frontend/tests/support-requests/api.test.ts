import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticate = vi.fn();
const insert = vi.fn();
const maybeSingle = vi.fn();
const from = vi.fn();
const rpc = vi.fn();

vi.mock("@/lib/sessions/api", async (original) => ({
  ...(await original<typeof import("@/lib/sessions/api")>()),
  authenticate: (...args: unknown[]) => authenticate(...args),
}));

const { POST } = await import("@/app/api/support-requests/route");

const ME = "a1b2c3d4-0001-4000-8000-000000000001";
const VOLUNTEER = "a1b2c3d4-0002-4000-8000-000000000002";

function nextWeekdayInKL(targetDay: number) {
  const now = new Date();
  const klDate = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const daysAhead = (targetDay - klDate.getUTCDay() + 7) % 7 || 7;
  const date = new Date(Date.UTC(klDate.getUTCFullYear(), klDate.getUTCMonth(), klDate.getUTCDate() + daysAhead));
  return {
    date: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`,
    weekday: new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" }).format(date),
  };
}

const MONDAY = nextWeekdayInKL(1);
const BODY = {
  title: "Help with programming",
  description: "I need help debugging my assignment.",
  category: "Programming",
  requested_date: MONDAY.date,
  requested_time: "15:00",
  support_mode: "Online",
  volunteer_id: VOLUNTEER,
  preferred_time: new Date(`${MONDAY.date}T15:00:00+08:00`).toISOString(),
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
  availabilityResult = { data: [{ day_of_week: MONDAY.weekday, start_time: "14:00", end_time: "17:00" }], error: null };
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
  rpc.mockResolvedValue({ data: [], error: null });
  from.mockImplementation((table: string) => {
    if (table === "volunteer_profile") return profileQuery;
    if (table === "availability") return availabilityQuery;
    if (table === "support_request") return { insert };
    throw new Error(`Unexpected table: ${table}`);
  });
  authenticate.mockResolvedValue({ me: { id: ME }, db: { from, rpc } });
  insert.mockResolvedValue({ error: null });
});

describe("POST /api/support-requests", () => {
  it("TCUC2_3 submits a valid request for an eligible volunteer", async () => {
    const response = await post(BODY);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith("get_volunteer_accepted_times", {
      p_volunteer_id: VOLUNTEER,
      p_requested_date: BODY.requested_date,
    });
    expect(insert).toHaveBeenCalledWith({ ...BODY, requester_id: ME, status: "Pending" });
  });

  it("TCUC2_4 rejects a request with a missing required field", async () => {
    const missingFields = [
      ["title", { title: "" }],
      ["description", { description: "" }],
      ["category", { category: undefined }],
      ["requested_date", { requested_date: undefined }],
      ["requested_time", { requested_time: undefined }],
      ["volunteer_id", { volunteer_id: undefined }],
      ["support_mode", { support_mode: "" }],
    ] as const;

    for (const [field, override] of missingFields) {
      const response = await post({ ...BODY, ...override });
      expect(response.status).toBe(400);
      expect((await response.json()).fields).toHaveProperty(field);
      expect(insert).not.toHaveBeenCalled();
    }
  });

  it("TCUC2_4 rejects a category the volunteer does not support", async () => {
    volunteerProfileResult = { data: { skills: ["Database"], is_volunteer: true }, error: null };
    const response = await post(BODY);
    expect(response.status).toBe(400);
    expect((await response.json()).fields).toHaveProperty("category");
    expect(rpc).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("TCUC2_4 rejects a date without matching weekday availability", async () => {
    availabilityResult = { data: [{ day_of_week: MONDAY.weekday === "Mon" ? "Tue" : "Mon", start_time: "14:00", end_time: "17:00" }], error: null };
    const response = await post(BODY);
    expect(response.status).toBe(400);
    expect((await response.json()).fields).toHaveProperty("requested_date");
    expect(insert).not.toHaveBeenCalled();
  });

  it("TCUC2_4 rejects a requested hour that starts outside availability", async () => {
    availabilityResult = { data: [{ day_of_week: MONDAY.weekday, start_time: "16:00", end_time: "17:00" }], error: null };
    const response = await post(BODY);
    expect(response.status).toBe(400);
    expect((await response.json()).fields).toHaveProperty("requested_time");
    expect(insert).not.toHaveBeenCalled();
  });

  it("TCUC2_4 rejects a start time inside availability when a full hour does not fit", async () => {
    availabilityResult = { data: [{ day_of_week: MONDAY.weekday, start_time: "14:00", end_time: "15:30" }], error: null };
    const response = await post(BODY);
    expect(response.status).toBe(400);
    expect((await response.json()).fields).toHaveProperty("requested_time");
    expect(insert).not.toHaveBeenCalled();
  });

  it("TCUC2_4 rejects a request overlapping an accepted request from the schedule RPC", async () => {
    rpc.mockResolvedValue({ data: [{ requested_time: "15:30:00" }], error: null });
    const response = await post(BODY);
    expect(response.status).toBe(400);
    expect((await response.json()).fields).toHaveProperty("requested_time");
    expect(rpc).toHaveBeenCalledWith("get_volunteer_accepted_times", {
      p_volunteer_id: VOLUNTEER,
      p_requested_date: BODY.requested_date,
    });
    expect(insert).not.toHaveBeenCalled();
  });
});
