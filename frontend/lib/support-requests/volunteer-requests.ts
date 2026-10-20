import type { supabase } from "@/lib/supabaseClient";
import { supportHistoryQuery, type SupportRequestStatus } from "@/lib/support-requests/history";

export type VolunteerRequestView = "incoming" | "sessions" | "history";

export type VolunteerRequestItem = {
  id: string;
  title: string;
  category: string;
  requested_date: string;
  requested_time: string;
  support_mode: string | null;
  requester_id: string;
  requester_name: string;
  status: SupportRequestStatus;
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
    .select("request_id, title, category, requested_date, requested_time, support_mode, requester_id, status")
    .eq(ownerColumn, historyQuery?.ownerId ?? volunteerId)
    .in("status", statuses)
    .order("requested_date", { ascending: true });

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

  return {
    items: rows.map((row) => {
      const { request_id, ...request } = row;
      return {
        ...request,
        id: request_id,
        status: String(row.status) as SupportRequestStatus,
        requester_name: names.get(row.requester_id) ?? "Student",
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