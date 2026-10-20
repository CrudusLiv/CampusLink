export type RequestResponse = "Accepted" | "Declined";

export function canRespondToRequest(
  currentStatus: string,
  nextStatus: RequestResponse,
) {
  return currentStatus === "Pending";
}