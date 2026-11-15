import { NextResponse } from "next/server";
import { authenticate, fail, unauthorized } from "@/lib/sessions/api";
import { validateVolunteerEligibility } from "@/lib/support-requests/volunteer-eligibility";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(req);
  if (!auth) return unauthorized();
  const { id } = await params;
  const body = await req.json().catch(() => null) as { expectedVolunteerId?: string; volunteerId?: string } | null;
  if (!body?.expectedVolunteerId || !body.volunteerId) return fail(400, "validation", "Choose a different volunteer.");

  const { data: request, error: requestError } = await auth.db.from("support_request")
    .select("category, requested_date, requested_time")
    .eq("request_id", id)
    .eq("requester_id", auth.me.id)
    .eq("status", "Pending")
    .eq("volunteer_id", body.expectedVolunteerId)
    .maybeSingle();
  if (requestError) return fail(500, "unknown", "We could not verify this support request.");
  if (!request) return fail(409, "conflict", "This request or its volunteer assignment has changed.");

  const eligibility = await validateVolunteerEligibility(auth.db, {
    volunteerId: body.volunteerId,
    category: request.category,
    requestedDate: request.requested_date,
    requestedTime: request.requested_time,
  });
  if (!eligibility.ok) {
    if (eligibility.reason === "lookup") return fail(500, "unknown", "We could not verify the selected volunteer's availability and schedule.");
    if (eligibility.reason === "inactive") return fail(400, "validation", "Choose an active volunteer.");
    if (eligibility.reason === "category") return fail(400, "validation", "The selected volunteer does not support this category.");
    if (eligibility.reason === "date") return fail(400, "validation", "The selected volunteer is not available on this date.");
    if (eligibility.reason === "time") return fail(400, "validation", "The selected volunteer is not available at this time.");
    if (eligibility.reason === "conflict") return fail(409, "conflict", "The selected volunteer already has an accepted request at this time. Choose another available volunteer.");
  }

  const { data, error } = await auth.db.rpc("reassign_pending_support_request", {
    p_request_id: id,
    p_expected_volunteer_id: body.expectedVolunteerId,
    p_new_volunteer_id: body.volunteerId,
  });
  if (error) {
    const message = error.message ?? "";
    if (message.includes("PREFERRED_TIME_REQUIRED")) return fail(400, "validation", "This support request does not have a valid preferred time. Please update the request before changing volunteers.");
    if (message.includes("REQUEST_NOT_OWNED")) return fail(404, "not_found", "We couldn't find this support request.");
    if (message.includes("REQUEST_NOT_PENDING")) return fail(409, "conflict", "This request is no longer pending.");
    if (message.includes("ASSIGNMENT_CHANGED")) return fail(409, "conflict", "The assigned volunteer changed. Reload the request and try again.");
    if (message.includes("VOLUNTEER_INELIGIBLE")) return fail(400, "validation", "Choose an eligible volunteer for this request category.");
    if (message.includes("VOLUNTEER_UNAVAILABLE")) return fail(400, "validation", "The selected volunteer is not available at the request's date and time.");
    if (message.includes("VOLUNTEER_TIME_CONFLICT")) return fail(409, "conflict", "The selected volunteer has a conflicting commitment. Choose another available volunteer.");
    if (message.includes("INVALID_VOLUNTEER")) return fail(400, "validation", "Choose a different volunteer.");
    console.error("POST /api/support-requests/[id]/reassign failed:", error.code, error.message);
    return fail(500, "unknown", "We couldn't change the volunteer. Please try again.");
  }
  return NextResponse.json({ success: true, assignmentVersion: data });
}
