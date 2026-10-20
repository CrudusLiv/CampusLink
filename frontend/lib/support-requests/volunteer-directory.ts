import type { supabase } from "@/lib/supabaseClient";

export type VolunteerDirectoryEntry = {
  user_id: string;
  name: string;
  photo_url: string | null;
  faculty: string | null;
  skills: string[];
  availability: { day: string; start: string; end: string }[];
};

type VolunteerRow = {
  user_id: string;
  skills: string[] | null;
};

type ProfileRow = {
  user_id: string;
  name: string;
  photo_url: string | null;
  faculty: string | null;
};

type AvailabilityRow = {
  user_id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
};

export type VolunteerDirectoryLoadResult = {
  currentUserId: string | null;
  volunteers: VolunteerDirectoryEntry[];
  error: "volunteer-list" | "volunteer-details" | null;
};

export async function loadVolunteerDirectory(
  db: typeof supabase,
): Promise<VolunteerDirectoryLoadResult> {
  const [{ data: authData }, { data: volunteerData, error: volunteerError }] =
    await Promise.all([
      db.auth.getUser(),
      db
        .from("volunteer_profile")
        .select("user_id, skills")
        .eq("is_volunteer", true),
    ]);

  const currentUserId = authData.user?.id ?? null;

  if (volunteerError) {
    return { currentUserId, volunteers: [], error: "volunteer-list" };
  }

  const rows = (volunteerData ?? []) as VolunteerRow[];

  if (rows.length === 0) {
    return { currentUserId, volunteers: [], error: null };
  }

  const userIds = rows.map((row) => row.user_id);

  const [
    { data: profileData, error: profileError },
    { data: availabilityData, error: availabilityError },
  ] = await Promise.all([
    db
      .from("users")
      .select("user_id, name, photo_url, faculty")
      .in("user_id", userIds),
    db
      .from("availability")
      .select("user_id, day_of_week, start_time, end_time")
      .in("user_id", userIds),
  ]);

  if (profileError || availabilityError) {
    return { currentUserId, volunteers: [], error: "volunteer-details" };
  }

  const profiles = (profileData ?? []) as ProfileRow[];
  const availability = (availabilityData ?? []) as AvailabilityRow[];

  const profileById = new Map(
    profiles.map((profile) => [profile.user_id, profile]),
  );

  const availabilityById = new Map<
    string,
    VolunteerDirectoryEntry["availability"]
  >();

  for (const slot of availability) {
    const slots = availabilityById.get(slot.user_id) ?? [];
    slots.push({
      day: slot.day_of_week,
      start: slot.start_time,
      end: slot.end_time,
    });
    availabilityById.set(slot.user_id, slots);
  }

  const volunteers = rows.flatMap((row) => {
    const profile = profileById.get(row.user_id);
    if (!profile) return [];

    return [{
      user_id: row.user_id,
      name: profile.name,
      photo_url: profile.photo_url,
      faculty: profile.faculty,
      skills: row.skills ?? [],
      availability: availabilityById.get(row.user_id) ?? [],
    }];
  });

  return { currentUserId, volunteers, error: null };
}
