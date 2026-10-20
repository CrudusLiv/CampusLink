"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { scheduleSession } from "@/lib/sessions/client";
import { overlaps } from "@/lib/sessions/slots";
import { SUPPORT_MODES, type AvailabilityRow, type DayOfWeek } from "@/lib/sessions/types";
import RequestStatusBadge from "@/components/support-requests/RequestStatusBadge";
import { canRespondToRequest } from "@/lib/support-requests/request-response";
import {
  loadVolunteerRequests,
  type VolunteerRequestItem,
  type VolunteerRequestView,
} from "@/lib/support-requests/volunteer-requests";
import styles from "./VolunteerDashboard.module.css";

type VolunteerRequest = VolunteerRequestItem & { isFree: boolean };

/** Request date and time are Kuala Lumpur wall time (UTC+8, no DST). */
const requestedIso = (date: string, time: string) =>
  new Date(`${date}T${time.slice(0, 5)}:00+08:00`).toISOString();

function isWithinAvailability(availability: AvailabilityRow[], date: string, time: string) {
  const dayNames: DayOfWeek[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const day = dayNames[new Date(`${date}T00:00:00Z`).getUTCDay()];
  const [hours, minutes] = time.split(":").map(Number);
  const start = hours * 60 + minutes;
  const end = start + 60;

  return availability.some((slot) => {
    const [startHour, startMinute] = slot.startTime.split(":").map(Number);
    const [endHour, endMinute] = slot.endTime.split(":").map(Number);
    return slot.dayOfWeek === day
      && start >= startHour * 60 + startMinute
      && end <= endHour * 60 + endMinute;
  });
}

const VIEW_CONFIG = {
  incoming: { title: "Incoming Requests", empty: "No incoming requests." },
  sessions: { title: "My Sessions", empty: "No accepted sessions yet." },
  history: { title: "My History", empty: "Your support requests will appear here." },
} as const;

export default function VolunteerRequestList({ view }: { view: VolunteerRequestView }) {
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
      setState("loading");
      try {
        const result = await loadVolunteerRequests(supabase, view, profile!.user_id);
        if (cancelled) return;
        if (result.error) {
          setState("error");
          return;
        }

        let enriched: VolunteerRequest[] = result.items.map((item) => ({ ...item, isFree: true }));
        if (view === "incoming" && result.items.length) {
          const { data: availabilityRows, error: availabilityError } = await supabase
            .from("availability")
            .select("day_of_week,start_time,end_time")
            .eq("user_id", profile!.user_id);
          if (cancelled) return;
          if (availabilityError) {
            setState("error");
            return;
          }

          const availability: AvailabilityRow[] = (availabilityRows ?? []).map((row) => ({
            dayOfWeek: row.day_of_week as DayOfWeek,
            startTime: row.start_time,
            endTime: row.end_time,
          }));
          const checked = await Promise.all(result.items.map(async (item) => {
            const scheduledDatetime = requestedIso(item.requested_date, item.requested_time);
            const { data: busyRows, error: busyError } = await supabase.rpc("get_busy_times", { p_request_id: item.id });
            if (busyError) throw busyError;
            const busy = ((busyRows ?? []) as { scheduled_datetime: string }[]).map((row) => row.scheduled_datetime);
            const startMs = new Date(scheduledDatetime).getTime();
            const isFree = startMs > Date.now()
              && isWithinAvailability(availability, item.requested_date, item.requested_time)
              && !busy.some((time) => overlaps(new Date(time).getTime(), startMs));
            return { ...item, isFree };
          }));
          if (cancelled) return;
          enriched = checked;
        }

        setItems(enriched);
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [profile, view]);

  async function respondToRequest(requestId: string, status: "Accepted" | "Declined") {
    const request = items.find((item) => item.id === requestId);

    if (
      !profile ||
      respondingId ||
      view !== "incoming" ||
      !request ||
      (status === "Accepted" && !request.isFree) ||
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

    // If booking fails, the accepted request remains available under My Sessions for manual scheduling.
    if (status === "Accepted") {
      const mode = SUPPORT_MODES.find((candidate) => candidate === request.support_mode);
      const booked = mode
        ? await scheduleSession({ requestId, scheduledDatetime: requestedIso(request.requested_date, request.requested_time), supportMode: mode })
        : null;
      if (!booked?.ok) {
        setActionError(`Request accepted, but the session was not booked: ${booked?.message ?? "no support mode was chosen"}. Schedule it from My Sessions.`);
      }
    }
    setRespondingId(null);
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
              <span>{new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${item.requested_date}T00:00:00Z`))}, {item.requested_time.slice(0, 5)} · {item.support_mode ?? "Support"}</span>
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
