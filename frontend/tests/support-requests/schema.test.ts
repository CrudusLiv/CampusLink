import { describe, expect, it } from "vitest";
import { supportRequestCreateSchema } from "@/lib/support-requests/schema";

describe("support request validation", () => {
  it("TCUC2_1 accepts valid support request details", () => {
    const input = {
      title: "Help with programming",
      description: "I need help debugging my assignment.",
      category: "Programming",
      requested_date: "2026-10-20",
      requested_time: "15:00",
      support_mode: "Online",
      volunteer_id: "a1b2c3d4-0002-4000-8000-000000000002",
      preferred_time: "2026-10-20T07:00:00.000Z",
    };

    const result = supportRequestCreateSchema.safeParse(input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(input);
    }
  });

  it.each([
    ["empty title", { title: "   " }],
    ["empty description", { description: "   " }],
    ["empty category", { category: "   " }],
    ["empty support mode", { support_mode: "   " }],
    ["invalid date", { requested_date: "20-10-2026" }],
    ["invalid time", { requested_time: "25:61" }],
    ["invalid volunteer ID", { volunteer_id: "not-a-uuid" }],
    ["invalid preferred time", { preferred_time: "tomorrow" }],
  ])("TCUC2_2 rejects %s", (_caseName, override) => {
    const input = {
      title: "Help with programming",
      description: "I need help debugging my assignment.",
      category: "Programming",
      requested_date: "2026-10-20",
      requested_time: "15:00",
      support_mode: "Online",
      volunteer_id: "a1b2c3d4-0002-4000-8000-000000000002",
      preferred_time: "2026-10-20T07:00:00.000Z",
      ...override,
    };

    const result = supportRequestCreateSchema.safeParse(input);

    expect(result.success).toBe(false);
  });
});