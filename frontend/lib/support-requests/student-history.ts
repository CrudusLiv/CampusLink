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
  rating: number | null;
};

type RequestRow = Omit<StudentHistoryRow, "id" | "volunteer_name" | "rating"> & {
  request_id: string;
};

type VolunteerRow = { user_id: string; name: string };

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

  return {
    rows: requests.map((row) => ({
      id: row.request_id,
      title: row.title,
      category: row.category,
      requested_date: row.requested_date,
      volunteer_id: row.volunteer_id,
      volunteer_name: row.volunteer_id ? names.get(row.volunteer_id) ?? null : null,
      status: row.status,
      rating: null,
    })),
    error: null,
  };
}