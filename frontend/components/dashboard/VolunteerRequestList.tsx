"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/lib/useCurrentUser";
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
  status: string;
};

const VIEW_CONFIG = {
  incoming: { title: "Incoming Requests", statuses: ["Pending"], empty: "No incoming requests." },
  sessions: { title: "My Sessions", statuses: ["Accepted"], empty: "No accepted sessions yet." },
  history: { title: "My History", statuses: ["Completed", "Cancelled", "Declined"], empty: "Your completed, cancelled, and declined requests will appear here." },
} as const;

export default function VolunteerRequestList({ view }: { view: keyof typeof VIEW_CONFIG }) {
  const { profile } = useCurrentUser();
  const [items, setItems] = useState<VolunteerRequest[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const config = VIEW_CONFIG[view];

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .from("support_request")
        .select("request_id, title, category, requested_date, requested_time, support_mode, requester_id, status")
        .eq("volunteer_id", profile!.user_id)
        .in("status", [...config.statuses])
        .order("requested_date", { ascending: true });
      if (cancelled) return;
      if (error) { setState("error"); return; }

      const rows = data ?? [];
      const requesterIds = [...new Set(rows.map((row) => row.requester_id))];
      const { data: requesters, error: requesterError } = requesterIds.length
        ? await supabase.from("users").select("user_id, name").in("user_id", requesterIds)
        : { data: [], error: null };
      if (cancelled) return;
      if (requesterError) { setState("error"); return; }
      const names = new Map((requesters ?? []).map((requester) => [requester.user_id, requester.name]));
      setItems(rows.map((row) => ({
        ...row,
        id: row.request_id,
        status: String(row.status),
        requester_name: names.get(row.requester_id) ?? "Student",
      })));
      setState("ready");
    }

    load();
    return () => { cancelled = true; };
  }, [profile, config.statuses]);

  async function respondToRequest(requestId: string, status: "Accepted" | "Declined") {
    if (!profile || respondingId || view !== "incoming") return;
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
    setRespondingId(null);
    if (error || !data) {
      setActionError("We couldn't update this request. Apply the volunteer dashboard migration and try again.");
      return;
    }
    setItems((current) => current.filter((item) => item.id !== requestId));
  }

  return (
    <main className={styles.content}>
      {actionError && <p className={styles.error} role="alert">{actionError}</p>}
      {state === "loading" ? <p className={styles.empty}>Loading…</p> : state === "error" ? (
        <p className={styles.error} role="alert">We couldn't load this list. Check that the volunteer dashboard migration has been applied.</p>
      ) : items.length === 0 ? <p className={styles.empty}>{config.empty}</p> : (
        <ul className={styles.list}>
          {items.map((item) => <li key={item.id} className={styles.requestCard}>
            <div>
              <strong>{item.requester_name}</strong>
              <span>{item.title} · {item.category}</span>
              <span>{new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(`${item.requested_date}T00:00:00`))}, {item.requested_time.slice(0, 5)} · {item.support_mode ?? "Support"}</span>
            </div>
            {view === "incoming" ? <div className={styles.requestActions}>
              <button type="button" className={styles.acceptButton} disabled={respondingId !== null} onClick={() => respondToRequest(item.id, "Accepted")}>{respondingId === item.id ? "…" : "Accept"}</button>
              <button type="button" className={styles.declineButton} disabled={respondingId !== null} onClick={() => respondToRequest(item.id, "Declined")}>Decline</button>
            </div> : <span className={styles.status}>{item.status}</span>}
          </li>)}
        </ul>
      )}
    </main>
  );
}
