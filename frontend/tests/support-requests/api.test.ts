import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticate = vi.fn();
const insert = vi.fn();
const from = vi.fn(() => ({ insert }));

vi.mock("@/lib/sessions/api", async (original) => ({
  ...(await original<typeof import("@/lib/sessions/api")>()),
  authenticate: (...args: unknown[]) => authenticate(...args),
}));

const { POST } = await import("@/app/api/support-requests/route");

const ME = "a1b2c3d4-0001-4000-8000-000000000001";
const OTHER = "a1b2c3d4-0002-4000-8000-000000000002";
const BODY = {
  title: "Help with programming",
  description: "I need help debugging my assignment.",
  category: "Programming",
  requested_date: "2026-10-20",
  requested_time: "15:00",
  support_mode: "Online",
  volunteer_id: OTHER,
  preferred_time: "2026-10-20T07:00:00.000Z",
};

const post = (body: unknown) => POST(new Request("http://localhost/api/support-requests", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
}));

beforeEach(() => {
  vi.resetAllMocks();
  authenticate.mockResolvedValue({ me: { id: ME }, db: { from } });
  from.mockReturnValue({ insert } as never);
  insert.mockResolvedValue({ error: null });
});

describe("POST /api/support-requests", () => {
  it("rejects self-assignment with a clear validation error before inserting", async () => {
    const response = await post({ ...BODY, volunteer_id: ME });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: "validation",
      message: "You cannot select yourself as a volunteer.",
      fields: { volunteer_id: "You cannot select yourself as a volunteer." },
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("creates a request for another volunteer using the authenticated requester ID", async () => {
    const response = await post(BODY);
    expect(response.status).toBe(201);
    expect(from).toHaveBeenCalledWith("support_request");
    expect(insert).toHaveBeenCalledWith({ ...BODY, requester_id: ME, status: "Pending" });
  });

  it("translates the database self-volunteer constraint as a validation error", async () => {
    insert.mockResolvedValue({ error: { code: "23514", message: "violates support_request_no_self_volunteer" } });
    const response = await post(BODY);
    expect(response.status).toBe(400);
    expect((await response.json()).message).toBe("You cannot select yourself as a volunteer.");
  });
});
