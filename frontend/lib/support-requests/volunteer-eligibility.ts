import type { Db } from "@/lib/sessions/server";
import { TZ } from "@/lib/sessions/time";

export type VolunteerEligibilityInput = {
  volunteerId: string;
  category: string;
  requestedDate: string;
  requestedTime: string;
};

function minutes(value: string) {
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
}

/** Shares the category, weekly availability, one-hour slot, and accepted-request rules used for request creation. */
export async function validateVolunteerEligibility(db: Db, input: VolunteerEligibilityInput) {
  const [{ data: volunteer, error: volunteerError }, { data: availability, error: availabilityError }] = await Promise.all([
    db.from("volunteer_profile").select("skills, is_volunteer").eq("user_id", input.volunteerId).maybeSingle(),
    db.from("availability").select("day_of_week, start_time, end_time").eq("user_id", input.volunteerId),
  ]);
  if (volunteerError || availabilityError) return { ok: false as const, reason: "lookup" as const };
  if (!volunteer?.is_volunteer) return { ok: false as const, reason: "inactive" as const };
  if (!(volunteer.skills ?? []).includes(input.category)) return { ok: false as const, reason: "category" as const };

  const requestedAt = new Date(`${input.requestedDate}T${input.requestedTime.slice(0, 5)}:00+08:00`);
  if (Number.isNaN(requestedAt.getTime())) return { ok: false as const, reason: "time" as const };
  const requestDay = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(requestedAt);
  const dayAvailability = (availability ?? []).filter((slot) => slot.day_of_week === requestDay);
  if (!dayAvailability.length) return { ok: false as const, reason: "date" as const };
  const requestedStart = minutes(input.requestedTime);
  if (!dayAvailability.some((slot) => minutes(slot.start_time) <= requestedStart && requestedStart + 60 <= minutes(slot.end_time))) {
    return { ok: false as const, reason: "time" as const };
  }

  const { data: acceptedRequests, error: acceptedError } = await db.rpc("get_volunteer_accepted_times", {
    p_volunteer_id: input.volunteerId,
    p_requested_date: input.requestedDate,
  });
  if (acceptedError) return { ok: false as const, reason: "lookup" as const };
  const requestedEnd = requestedStart + 60;
  const hasConflict = ((acceptedRequests ?? []) as { requested_time: string }[]).some((accepted) => {
    const acceptedStart = minutes(accepted.requested_time);
    return requestedStart < acceptedStart + 60 && requestedEnd > acceptedStart;
  });
  if (hasConflict) return { ok: false as const, reason: "conflict" as const, acceptedTimes: acceptedRequests ?? [] };
  return { ok: true as const, acceptedTimes: acceptedRequests ?? [] };
}
