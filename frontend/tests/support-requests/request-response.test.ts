import { describe, expect, it } from "vitest";
import { canRespondToRequest } from "@/lib/support-requests/request-response";

describe("TCUC2_30 allows valid responses to a pending request", () => {
  it.each(["Accepted", "Declined"] as const)(
    "allows Pending to become %s",
    (status) => {
      expect(canRespondToRequest("Pending", status)).toBe(true);
    },
  );
});

describe("TCUC2_31 prevents responses to requests that are no longer pending", () => {
  it.each(["Accepted", "Declined", "Completed", "Cancelled"])(
    "rejects another response when the current status is %s",
    (currentStatus) => {
      expect(canRespondToRequest(currentStatus, "Accepted")).toBe(false);
    },
  );
});