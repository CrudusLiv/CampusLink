import { NextResponse } from "next/server";
import { authenticate, fail, unauthorized } from "@/lib/sessions/api";
import { fieldErrors } from "@/lib/sessions/schemas";
import { supportRequestCreateSchema } from "@/lib/support-requests/schema";
import { isSelfVolunteerConstraintError } from "@/lib/support-requests/volunteers";

const SELF_VOLUNTEER_MESSAGE = "You cannot select yourself as a volunteer.";

/** Create a support request as the authenticated help seeker. */
export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (!auth) return unauthorized();

  const body = await req.json().catch(() => null);
  const input = supportRequestCreateSchema.safeParse(body);
  if (!input.success) return fail(400, "validation", "Please check the highlighted fields", fieldErrors(input.error));
  if (input.data.volunteer_id === auth.me.id) {
    return fail(400, "validation", SELF_VOLUNTEER_MESSAGE, { volunteer_id: SELF_VOLUNTEER_MESSAGE });
  }

  const { error } = await auth.db.from("support_request").insert({
    requester_id: auth.me.id,
    ...input.data,
    status: "Pending",
  });

  if (error) {
    if (isSelfVolunteerConstraintError(error)) {
      return fail(400, "validation", SELF_VOLUNTEER_MESSAGE, { volunteer_id: SELF_VOLUNTEER_MESSAGE });
    }
    console.error("POST /api/support-requests failed:", error.code, error.message);
    return fail(500, "unknown", "We could not submit your support request");
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
