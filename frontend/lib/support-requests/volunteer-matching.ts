import type { supabase } from "@/lib/supabaseClient";
export function matchesVolunteerSkill(
  skills: string[],
  category: string,
) {
  return !category || skills.includes(category);
}

type AvailabilitySlot = {
  day: string;
  start: string;
  end: string;
};

export function matchesVolunteerSchedule(
  slots: AvailabilitySlot[],
  requestedDay: string,
  requestedTime: string,
) {
  if (!requestedDay && !requestedTime) return true;

  return slots.some((slot) => {
    const matchesDay = !requestedDay || slot.day === requestedDay;
    const time = requestedTime.slice(0, 5);
    const matchesTime =
      !time || slot.start.slice(0, 5) <= time && time < slot.end.slice(0, 5);

    return matchesDay && matchesTime;
  });
}

type MatchSlot = { day: string; start: string; end: string };
type MatchVolunteer = {
  user_id: string;
  name: string;
  photo_url: string | null;
  skills: string[];
  availability: MatchSlot[];
};

export async function loadMatchingVolunteers(
  db: typeof supabase,
  requesterId: string,
  category: string,
): Promise<{ volunteers: MatchVolunteer[]; error: "volunteers" | "details" | null }> {
  const { data, error } = await db
    .from("volunteer_profile")
    .select("user_id, skills")
    .eq("is_volunteer", true);

  if (error) return { volunteers: [], error: "volunteers" };

  const eligible = (data ?? []).filter(
    (row) =>
      row.user_id !== requesterId &&
      (!category || (row.skills ?? []).includes(category)),
  );
  if (!eligible.length) return { volunteers: [], error: null };

  const ids = eligible.map((row) => row.user_id);
  const [{ data: profiles, error: profileError }, { data: slots, error: slotsError }] =
    await Promise.all([
      db.from("users").select("user_id, name, photo_url").in("user_id", ids),
      db.from("availability").select("user_id, day_of_week, start_time, end_time").in("user_id", ids),
    ]);

  if (profileError || slotsError) return { volunteers: [], error: "details" };

  const profileById = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]));
  const slotsById = new Map<string, MatchSlot[]>();

  for (const slot of slots ?? []) {
    const current = slotsById.get(slot.user_id) ?? [];
    current.push({
      day: slot.day_of_week,
      start: slot.start_time,
      end: slot.end_time,
    });
    slotsById.set(slot.user_id, current);
  }

  return {
    volunteers: eligible.flatMap((row) => {
      const profile = profileById.get(row.user_id);
      return profile
        ? [{
            user_id: row.user_id,
            name: profile.name,
            photo_url: profile.photo_url,
            skills: row.skills ?? [],
            availability: slotsById.get(row.user_id) ?? [],
          }]
        : [];
    }),
    error: null,
  };
}

export function selectVolunteerRecommendations(
  volunteers: MatchVolunteer[],
  requesterId: string,
  requestedDay: string,
  requestedTime: string,
) {
  return volunteers
    .filter(
      (volunteer) =>
        volunteer.user_id !== requesterId &&
        matchesVolunteerSchedule(
          volunteer.availability,
          requestedDay,
          requestedTime,
        ),
    )
    .slice(0, 3)
    .map(({ availability, ...volunteer }) => volunteer);
}