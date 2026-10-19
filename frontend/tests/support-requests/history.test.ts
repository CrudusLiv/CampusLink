import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  STATUS_BADGE_CLASS,
  SUPPORT_HISTORY_STATUSES,
  supportHistoryQuery,
  supportRequestStatusPresentation,
  type SupportRequestStatus,
} from "@/lib/support-requests/history";

const STUDENT_ID = "a1b2c3d4-0001-4000-8000-000000000001";
const VOLUNTEER_ID = "a1b2c3d4-0002-4000-8000-000000000002";
const badgeCss = readFileSync(new URL("../../components/support-requests/RequestStatusBadge.module.css", import.meta.url), "utf8");

describe("support history query scope", () => {
  it("loads all five statuses for the student's own requests, including Completed", () => {
    const query = supportHistoryQuery("student", STUDENT_ID);
    expect(query.ownerColumn).toBe("requester_id");
    expect(query.ownerId).toBe(STUDENT_ID);
    expect(query.statuses).toEqual(["Pending", "Accepted", "Completed", "Cancelled", "Declined"]);
    expect(query.statuses).toContain("Completed");
  });

  it("loads all five statuses for requests assigned to the volunteer, including Completed", () => {
    const query = supportHistoryQuery("volunteer", VOLUNTEER_ID);
    expect(query.ownerColumn).toBe("volunteer_id");
    expect(query.ownerId).toBe(VOLUNTEER_ID);
    expect(query.statuses).toEqual(["Pending", "Accepted", "Completed", "Cancelled", "Declined"]);
    expect(query.statuses).toContain("Completed");
  });
});

describe("support request status badges", () => {
  const colors: Record<SupportRequestStatus, { background: string; foreground: string }> = {
    Pending: { background: "#fef3c7", foreground: "#78350f" },
    Accepted: { background: "#dcfce7", foreground: "#166534" },
    Completed: { background: "#bbf7d0", foreground: "#14532d" },
    Cancelled: { background: "#e5e7eb", foreground: "#374151" },
    Declined: { background: "#fee2e2", foreground: "#991b1b" },
  };

  it.each(SUPPORT_HISTORY_STATUSES)("shows %s as readable text with its matching palette", (status) => {
    const presentation = supportRequestStatusPresentation(status);
    expect(presentation).toEqual({ label: status, className: STATUS_BADGE_CLASS[status] });

    const rule = new RegExp(`\\.${presentation.className}\\s*\\{([^}]+)\\}`).exec(badgeCss)?.[1];
    expect(rule).toBeTruthy();
    expect(rule).toContain(`background: ${colors[status].background}`);
    expect(rule).toContain(`color: ${colors[status].foreground}`);
  });
});
