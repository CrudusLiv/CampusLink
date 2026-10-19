export const SUPPORT_HISTORY_STATUSES = [
  "Pending",
  "Accepted",
  "Completed",
  "Cancelled",
  "Declined",
] as const;

export type SupportRequestStatus = (typeof SUPPORT_HISTORY_STATUSES)[number];
export type SupportHistoryRole = "student" | "volunteer";

export const STATUS_BADGE_CLASS: Record<SupportRequestStatus, string> = {
  Pending: "pending",
  Accepted: "accepted",
  Completed: "completed",
  Cancelled: "cancelled",
  Declined: "declined",
};

export function supportRequestStatusPresentation(status: SupportRequestStatus) {
  return { label: status, className: STATUS_BADGE_CLASS[status] };
}

/** Keep each history query scoped to the signed-in participant and the same status set. */
export function supportHistoryQuery(role: SupportHistoryRole, userId: string) {
  return {
    ownerColumn: role === "student" ? "requester_id" as const : "volunteer_id" as const,
    ownerId: userId,
    statuses: SUPPORT_HISTORY_STATUSES,
  };
}
