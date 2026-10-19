"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/lib/useCurrentUser";
import RequestStatusBadge from "@/components/support-requests/RequestStatusBadge";
import { canRespondToRequest } from "@/lib/support-requests/request-response";
import {
  loadVolunteerRequests,
  type VolunteerRequestItem,
  type VolunteerRequestView,
} from "@/lib/support-requests/volunteer-requests";
import styles from "./VolunteerDashboard.module.css";

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
              <button type="button" className={styles.acceptButton} disabled={respondingId !== null} onClick={() => respondToRequest(item.id, "Accepted")}>{respondingId === item.id ? "…" : "Accept"}</button>
              <button type="button" className={styles.declineButton} disabled={respondingId !== null} onClick={() => respondToRequest(item.id, "Declined")}>Decline</button>
            </div> : <RequestStatusBadge status={item.status} />}
          </li>)}
        </ul>
      )}
    </main>
  );
}
