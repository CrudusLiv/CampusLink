"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { scheduleSession } from "@/lib/sessions/client";
import { generateSlots } from "@/lib/sessions/slots";
import { SUPPORT_MODES, type DayOfWeek } from "@/lib/sessions/types";
import RequestStatusBadge from "@/components/support-requests/RequestStatusBadge";
import { canRespondToRequest } from "@/lib/support-requests/request-response";
import {
  loadVolunteerRequests,
  type VolunteerRequestItem,
  type VolunteerRequestView,
} from "@/lib/support-requests/volunteer-requests";
import styles from "./VolunteerDashboard.module.css";

type VolunteerRequest = {
  id: string;
  title: string;
  category: string;
  requested_date: string;
  requested_time: string;
  support_mode: string | null;
  requester_id: string;
  requester_name: string;
  status: SupportRequestStatus;
  isFree: boolean;
};

/** The requester's date and time are Kuala Lumpur wall time (UTC+8, no DST). */
const requestedIso = (date: string, time: string) => new Date(`${date}T${time.slice(0, 5)}:00+08:00`).toISOString();

const VIEW_CONFIG = {
  incoming: { title: "Incoming Requests", empty: "No incoming requests." },
  sessions: { title: "My Sessions", empty: "No accepted sessions yet." },
  history: { title: "My History", empty: "Your support requests will appear here." },
} as const;

export default function VolunteerRequestList({ view }: { view: VolunteerRequestView }) {
  const { profile } = useCurrentUser();
  const [items, setItems] = useState<VolunteerRequestItem[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const config = VIEW_CONFIG[view];

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    async function load() {
      const result = await loadVolunteerRequests(supabase, view, profile!.user_id);
      if (cancelled) return;
      if (result.error) {
        setState("error");
        return;
      }
      setItems(result.items);
      if (requesterError) { setState("error"); return; }
      const names = new Map((requesters ?? []).map((requester) => [requester.user_id, requester.name]));

      // Incoming requests carry a time chosen by the requester: only offer Accept when the volunteer is free then.
      let freeSlots = new Map<string, Set<string>>();
      if (view === "incoming" && rows.length) {
        const { data: avail } = await supabase.from("availability").select("day_of_week,start_time,end_time").eq("user_id", profile!.user_id);
        const availability = (avail ?? []).map((a) => ({ dayOfWeek: a.day_of_week as DayOfWeek, startTime: a.start_time, endTime: a.end_time }));
        const entries = await Promise.all(rows.map(async (row) => {
          const { data: busy } = await supabase.rpc("get_busy_times", { p_request_id: row.request_id });
          const starts = ((busy ?? []) as { scheduled_datetime: string }[]).map((b) => b.scheduled_datetime);
          return [row.request_id, new Set(generateSlots(availability, starts))] as const;
        }));
        freeSlots = new Map(entries);
        if (cancelled) return;
      }
      setItems(rows.map((row) => ({
        ...row,
        id: row.request_id,
        status: String(row.status) as SupportRequestStatus,
        requester_name: names.get(row.requester_id) ?? "Student",
        isFree: view !== "incoming" || (freeSlots.get(row.request_id)?.has(requestedIso(row.requested_date, row.requested_time)) ?? false),
      })));
      setState("ready");
    }

    load();
    return () => { cancelled = true; };
  }, [profile, view]);

  async function respondToRequest(requestId: string, status: "Accepted" | "Declined") {
    const request = items.find((item) => item.id === requestId);

    if (
      !profile ||
      respondingId ||
      view !== "incoming" ||
      !request ||
      !canRespondToRequest(request.status, status)
    ) return;
    setRespondingId(requestId);
    setActionError("");
    const { data, error } = await supabase
      .from("support_request")
      .update({ status })
      .eq("request_id", requestId)
      .eq("volunteer_id", profile.user_id)
      .eq("status", "Pending")
      .select("request_id")
      .maybeSingle();
    if (error || !data) {
      setRespondingId(null);
      setActionError("We couldn't update this request. Apply the volunteer dashboard migration and try again.");
      return;
    }
    // Accepting books the session at the time the requester chose. If that fails the request stays Accepted
    // and shows under My Sessions > "Waiting for a time", where it can be scheduled by hand.
    const item = items.find((i) => i.id === requestId);
    if (status === "Accepted" && item) {
      const mode = SUPPORT_MODES.find((m) => m === item.support_mode);
      const booked = mode
        ? await scheduleSession({ requestId, scheduledDatetime: requestedIso(item.requested_date, item.requested_time), supportMode: mode })
        : null;
      if (!booked?.ok) setActionError(`Request accepted, but the session was not booked: ${booked?.message ?? "no support mode was chosen"}. Schedule it from My Sessions.`);
    }
    setRespondingId(null);
    setItems((current) => current.filter((i) => i.id !== requestId));
  }

  return (
    <main className={styles.content}>
      {actionError && <p className={styles.error} role="alert">{actionError}</p>}
      {state === "loading" ? <p className={styles.empty}>Loading…</p> : state === "error" ? (
        <p className={styles.error} role="alert">We couldn&apos;t load this list. Check that the volunteer dashboard migration has been applied.</p>
      ) : items.length === 0 ? <p className={styles.empty}>{config.empty}</p> : (
        <ul className={styles.list}>
          {items.map((item) => <li key={item.id} className={styles.requestCard}>
            <div>
              <strong>{item.requester_name}</strong>
              <span>{item.title} · {item.category}</span>
              <span>{new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(`${item.requested_date}T00:00:00`))}, {item.requested_time.slice(0, 5)} · {item.support_mode ?? "Support"}</span>
            </div>
            {view === "incoming" ? <div className={styles.requestActions}>
              <button type="button" className={styles.acceptButton} disabled={respondingId !== null || !item.isFree} title={item.isFree ? undefined : "You are not available at the requested time"} onClick={() => respondToRequest(item.id, "Accepted")}>{respondingId === item.id ? "…" : item.isFree ? "Accept" : "Not available"}</button>
              <button type="button" className={styles.declineButton} disabled={respondingId !== null} onClick={() => respondToRequest(item.id, "Declined")}>Decline</button>
            </div> : <RequestStatusBadge status={item.status} />}
          </li>)}
        </ul>
      )}
    </main>
  );
}
