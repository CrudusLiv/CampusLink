import { NextResponse } from "next/server";
import { authenticate, fail, unauthorized } from "@/lib/sessions/api";
import { fieldErrors } from "@/lib/sessions/schemas";
import { supportRequestCreateSchema } from "@/lib/support-requests/schema";
import { isSelfVolunteerConstraintError } from "@/lib/support-requests/volunteers";
import { klDateKey, TZ } from "@/lib/sessions/time";
import { validateVolunteerEligibility } from "@/lib/support-requests/volunteer-eligibility";

const SELF_VOLUNTEER_MESSAGE = "You cannot select yourself as a volunteer.";
const ONE_HOUR_MS = 60 * 60 * 1000;

function formatMinuteOfDay(value: number) {
  const normalized = ((value % 1440) + 1440) % 1440;
  const date = new Date(Date.UTC(2000, 0, 1, Math.floor(normalized / 60), normalized % 60));
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hour12: true }).format(date);
}

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
  const eligibility = await validateVolunteerEligibility(auth.db, {
    volunteerId: input.data.volunteer_id,
    category: input.data.category,
    requestedDate: input.data.requested_date,
    requestedTime: input.data.requested_time,
  });
  if (!eligibility.ok) {
    if (eligibility.reason === "lookup") {
      console.error("POST /api/support-requests volunteer validation lookup failed");
      return fail(500, "unknown", "We could not verify the selected volunteer's availability and schedule");
    }
    if (eligibility.reason === "inactive") return fieldValidation("volunteer_id", "Choose an active volunteer.");
    if (eligibility.reason === "category") return fieldValidation("category", "The selected volunteer does not support this category.");
    if (eligibility.reason === "date") return fieldValidation("requested_date", "The selected volunteer is not available on this date.");
    if (eligibility.reason === "time") return fieldValidation("requested_time", "The selected volunteer is not available at this time.");
    if (eligibility.reason === "conflict") {
      const acceptedTimes = eligibility.acceptedTimes as { requested_time: string }[];
      const requestedTime = input.data.requested_time.slice(0, 5);
      const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
      const requestedStart = minutes(requestedTime);
      const conflictingStart = acceptedTimes.map((accepted) => minutes(accepted.requested_time)).find((start) => requestedStart < start + 60 && requestedStart + 60 > start)!;
      const beforeLimit = conflictingStart - 59;
      const nowInKualaLumpur = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
      const currentMinutes = Number(nowInKualaLumpur.find((part) => part.type === "hour")?.value) * 60 + Number(nowInKualaLumpur.find((part) => part.type === "minute")?.value);
      const canSuggestEarlier = beforeLimit > 0 && (input.data.requested_date !== klDateKey(new Date().toISOString()) || currentMinutes < beforeLimit);
      const earlier = canSuggestEarlier ? `before ${formatMinuteOfDay(beforeLimit)} or ` : "";
      return fieldValidation("requested_time", `This volunteer already has a request. Please choose a time ${earlier}after ${formatMinuteOfDay(conflictingStart + 60)}.`);
    }
  }

  if (requestedAt.getTime() < Date.now() + ONE_HOUR_MS) {
    return fieldValidation("requested_time", "Choose a time at least 1 hour from now.");
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
