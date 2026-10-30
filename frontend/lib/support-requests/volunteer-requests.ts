import type { supabase } from "@/lib/supabaseClient";
import { supportHistoryQuery, type SupportRequestStatus } from "@/lib/support-requests/history";

export type VolunteerRequestView = "incoming" | "sessions" | "history";

export type VolunteerRequestItem = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  requested_date: string;
  requested_time: string;
  support_mode: string | null;
  requester_id: string;
  requester_name: string;
  status: SupportRequestStatus;
  rating?: number | null;
};

type RequestRow = Omit<VolunteerRequestItem, "id" | "requester_name"> & {
  request_id: string;
};

type RequesterRow = { user_id: string; name: string };

export type VolunteerRequestLoadResult = {
  items: VolunteerRequestItem[];
  error: "requests" | "requesters" | null;
};

export async function loadVolunteerRequests(
  db: typeof supabase,
  view: VolunteerRequestView,
  volunteerId: string,
): Promise<VolunteerRequestLoadResult> {
  const historyQuery = view === "history"
    ? supportHistoryQuery("volunteer", volunteerId)
    : null;
  const ownerColumn = historyQuery?.ownerColumn ?? "volunteer_id";
  const statuses: SupportRequestStatus[] = view === "history"
    ? [...historyQuery!.statuses]
    : view === "incoming"
      ? ["Pending"]
      : ["Accepted"];

  const { data, error } = await db
    .from("support_request")
    .select("request_id, title, description, category, requested_date, requested_time, support_mode, requester_id, status")
    .eq(ownerColumn, historyQuery?.ownerId ?? volunteerId)
    .in("status", statuses)
    .order("requested_date", { ascending: view !== "history" });

  if (error) return { items: [], error: "requests" };

  const rows = (data ?? []) as unknown as RequestRow[];
  const requesterIds = [...new Set(rows.map((row) => row.requester_id))];
  const { data: requesters, error: requesterError } = requesterIds.length
    ? await db.from("users").select("user_id, name").in("user_id", requesterIds)
    : { data: [] as RequesterRow[], error: null };

  if (requesterError) return { items: [], error: "requesters" };

  const names = new Map(
    ((requesters ?? []) as unknown as RequesterRow[]).map((requester) => [
      requester.user_id,
      requester.name,
    ]),
  );

  const ratings = new Map<string, number>();
  if (view === "history" && rows.length) {
    const { data: sessions } = await db
      .from("session")
      .select("session_id, request_id")
      .in("request_id", rows.map((row) => row.request_id));
    const sessionRows = (sessions ?? []) as unknown as { session_id: string; request_id: string }[];
    if (sessionRows.length) {
      const { data: feedback } = await db
        .from("feedback")
        .select("session_id, rating")
        .in("session_id", sessionRows.map((row) => row.session_id));
      const feedbackRatings = new Map(
        ((feedback ?? []) as unknown as { session_id: string; rating: number }[])
          .map((row) => [row.session_id, Number(row.rating)]),
      );
      for (const session of sessionRows) {
        const rating = feedbackRatings.get(session.session_id);
        if (rating !== undefined) ratings.set(session.request_id, rating);
      }
    }
  }

  return {
    items: rows.map((row) => {
      const { request_id, ...request } = row;
      return {
        ...request,
        id: request_id,
        status: String(row.status) as SupportRequestStatus,
        requester_name: names.get(row.requester_id) ?? "Student",
        ...(view === "history" ? { rating: ratings.get(row.request_id) ?? null } : {}),
      };
    }),
    error: null,
  };
}

export async function saveVolunteerResponse(
  db: typeof supabase,
  requestId: string,
  volunteerId: string,
  status: "Accepted" | "Declined",
) {
  const { data, error } = await db
    .from("support_request")
    .update({ status })
    .eq("request_id", requestId)
    .eq("volunteer_id", volunteerId)
    .eq("status", "Pending")
    .select("request_id")
    .maybeSingle();

  return { saved: !error && Boolean(data) };
}
