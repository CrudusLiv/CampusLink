import type { supabase } from "@/lib/supabaseClient";
import {
  supportHistoryQuery,
  type SupportRequestStatus,
} from "@/lib/support-requests/history";

export type StudentHistoryRow = {
  id: string;
  title: string;
  category: string;
  requested_date: string;
  volunteer_id: string | null;
  volunteer_name: string | null;
  status: SupportRequestStatus;
  /** The Help Seeker's rating from the session feedback (one per session), or null if not rated yet. */
  rating: number | null;
  /** The session that belongs to this request, if one was booked; used to link to the rating form. */
  session_id: string | null;
};

type RequestRow = Omit<StudentHistoryRow, "id" | "volunteer_name" | "rating" | "session_id"> & {
  request_id: string;
};

type VolunteerRow = { user_id: string; name: string };

/** Looks up the session and the one feedback rating for each completed request. A failed lookup just shows no rating. */
async function loadSessionRatings(db: typeof supabase, requestIds: string[]) {
  const found = new Map<string, { sessionId: string; rating: number | null }>();
  if (requestIds.length === 0) return found;

  const { data: sessions } = await db.from("session").select("session_id, request_id").in("request_id", requestIds);
  const sessionRows = (sessions ?? []) as unknown as { session_id: string; request_id: string }[];
  if (sessionRows.length === 0) return found;

  const { data: feedback } = await db.from("feedback").select("session_id, rating").in("session_id", sessionRows.map((row) => row.session_id));
  const ratings = new Map(((feedback ?? []) as unknown as { session_id: string; rating: number }[]).map((row) => [row.session_id, Number(row.rating)]));

  for (const row of sessionRows) found.set(row.request_id, { sessionId: row.session_id, rating: ratings.get(row.session_id) ?? null });
  return found;
}

export async function loadStudentSupportHistory(
  db: typeof supabase,
  studentId: string,
): Promise<{ rows: StudentHistoryRow[]; error: "history" | "volunteers" | null }> {
  const query = supportHistoryQuery("student", studentId);
  const { data, error } = await db
    .from("support_request")
    .select("request_id, title, category, requested_date, volunteer_id, status")
    .eq(query.ownerColumn, query.ownerId)
    .in("status", [...query.statuses])
    .order("requested_date", { ascending: false });

  if (error) return { rows: [], error: "history" };

  const requests = (data ?? []) as unknown as RequestRow[];
  const volunteerIds = [
    ...new Set(requests.map((row) => row.volunteer_id).filter((id): id is string => Boolean(id))),
  ];

  const { data: volunteers, error: volunteerError } = volunteerIds.length
    ? await db.from("users").select("user_id, name").in("user_id", volunteerIds)
    : { data: [] as VolunteerRow[], error: null };

  if (volunteerError) return { rows: [], error: "volunteers" };

  const names = new Map(
    ((volunteers ?? []) as unknown as VolunteerRow[]).map((volunteer) => [
      volunteer.user_id,
      volunteer.name,
    ]),
  );

  const sessions = await loadSessionRatings(
    db,
    requests.filter((row) => row.status === "Completed").map((row) => row.request_id),
  );

  return {
    rows: requests.map((row) => ({
      id: row.request_id,
      title: row.title,
      category: row.category,
      requested_date: row.requested_date,
      volunteer_id: row.volunteer_id,
      volunteer_name: row.volunteer_id ? names.get(row.volunteer_id) ?? null : null,
      status: row.status,
      rating: sessions.get(row.request_id)?.rating ?? null,
      session_id: sessions.get(row.request_id)?.sessionId ?? null,
    })),
    error: null,
  };
}
