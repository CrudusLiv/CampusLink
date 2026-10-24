import { NextResponse } from "next/server";
import { authenticate, fail, unauthorized } from "@/lib/sessions/api";
import { fieldErrors } from "@/lib/sessions/schemas";
import { supportRequestCreateSchema } from "@/lib/support-requests/schema";
import { isSelfVolunteerConstraintError } from "@/lib/support-requests/volunteers";
import { klDateKey, TZ } from "@/lib/sessions/time";

const SELF_VOLUNTEER_MESSAGE = "You cannot select yourself as a volunteer.";
const ONE_HOUR_MS = 60 * 60 * 1000;

function requestedDateTime(date: string, time: string) {
  const normalizedTime = time.length === 5 ? `${time}:00` : time;
  return new Date(`${date}T${normalizedTime}+08:00`);
}

function fieldValidation(field: string, message: string) {
  return fail(400, "validation", message, { [field]: message });
}

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

  const requestedAt = requestedDateTime(input.data.requested_date, input.data.requested_time);
  if (Number.isNaN(requestedAt.getTime())) {
    return fieldValidation("requested_time", "Choose a valid request date and time.");
  }
  if (input.data.preferred_time && new Date(input.data.preferred_time).getTime() !== requestedAt.getTime()) {
    return fieldValidation("preferred_time", "The scheduled date and time do not match the request date and time.");
  }
  if (input.data.requested_date < klDateKey(new Date().toISOString())) {
    return fieldValidation("requested_date", "Choose today or a future date.");
  }
  if (requestedAt.getTime() < Date.now() + ONE_HOUR_MS) {
    return fieldValidation("requested_time", "Choose a time at least 1 hour from now.");
  }

  const [{ data: volunteer, error: volunteerError }, { data: availability, error: availabilityError }] = await Promise.all([
    auth.db.from("volunteer_profile")
      .select("skills, is_volunteer")
      .eq("user_id", input.data.volunteer_id)
      .maybeSingle(),
    auth.db.from("availability")
      .select("day_of_week, start_time, end_time")
      .eq("user_id", input.data.volunteer_id),
  ]);

  if (volunteerError || availabilityError) {
    console.error("POST /api/support-requests validation lookup failed:", volunteerError?.code, availabilityError?.code);
    return fail(500, "unknown", "We could not verify the selected volunteer's details");
  }
  if (!volunteer?.is_volunteer) {
    return fieldValidation("volunteer_id", "Choose an active volunteer.");
  }
  if (!(volunteer.skills ?? []).includes(input.data.category)) {
    return fieldValidation("category", "The selected volunteer does not support this category.");
  }

  const requestDay = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(requestedAt);
  const dayAvailability = (availability ?? []).filter((slot) => slot.day_of_week === requestDay);
  if (dayAvailability.length === 0) {
    return fieldValidation("requested_date", "The selected volunteer is not available on this date.");
  }
  const requestedTime = input.data.requested_time.slice(0, 5);
  const timeIsAvailable = dayAvailability.some((slot) =>
    slot.start_time.slice(0, 5) <= requestedTime && requestedTime < slot.end_time.slice(0, 5)
  );
  if (!timeIsAvailable) {
    return fieldValidation("requested_time", "The selected volunteer is not available at this time.");
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
