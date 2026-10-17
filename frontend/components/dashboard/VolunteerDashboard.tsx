"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { UpcomingSessionsSection } from "@/components/sessions/UpcomingSessionsSection";
import styles from "./VolunteerDashboard.module.css";

type DashboardRequest = {
  id: string;
  title: string;
  category: string;
  requested_date: string;
  requested_time: string;
  support_mode: string | null;
  requester_id: string;
  status: string;
  requester_name: string;
};

type DataState = "loading" | "ready" | "error";

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currentWeekRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start: dateKey(start), end: dateKey(end) };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(`${value}T00:00:00`));
}

export default function VolunteerDashboard() {
  const { profile } = useCurrentUser();
  const [requests, setRequests] = useState<DashboardRequest[]>([]);
  const [ratings, setRatings] = useState<number[]>([]);
  const [state, setState] = useState<DataState>("loading");
  const [attempt, setAttempt] = useState(0);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    async function loadDashboard() {
      setState("loading");
      const { data, error } = await supabase
        .from("support_request")
        .select("request_id, title, category, requested_date, requested_time, support_mode, requester_id, status")
        .eq("volunteer_id", profile!.user_id)
        .order("requested_date", { ascending: true });

      if (cancelled) return;
      if (error) {
        setState("error");
        return;
      }

      const rows = data ?? [];
      const requesterIds = [...new Set(rows.map((row) => row.requester_id))];
      const { data: requesters, error: requesterError } = requesterIds.length
        ? await supabase.from("users").select("user_id, name").in("user_id", requesterIds)
        : { data: [], error: null };

      if (cancelled) return;
      if (requesterError) {
        setState("error");
        return;
      }

      const names = new Map((requesters ?? []).map((requester) => [requester.user_id, requester.name]));
      setRequests(rows.map((row) => ({
        ...row,
        id: row.request_id,
        status: String(row.status),
        requester_name: names.get(row.requester_id) ?? "Student",
      })));

      // Ratings live in the feedback table (one per session). If it can't be read, show no average instead of failing.
      const { data: feedback } = await supabase.from("feedback").select("rating").eq("volunteer_id", profile!.user_id);
      if (cancelled) return;
      setRatings((feedback ?? []).map((item) => Number(item.rating)));
      setState("ready");
    }

    loadDashboard();
    return () => { cancelled = true; };
  }, [profile, attempt]);

  const metrics = useMemo(() => {
    const { start, end } = currentWeekRange();
    return {
      newRequests: requests.filter((request) => request.status === "Pending").length,
      sessionsThisWeek: requests.filter((request) => request.status === "Accepted" && request.requested_date >= start && request.requested_date < end).length,
      averageRating: ratings.length ? (ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1) : "0.0",
      sessionsCompleted: requests.filter((request) => request.status === "Completed").length,
    };
  }, [requests, ratings]);

  const newRequests = requests.filter((request) => request.status === "Pending").slice(0, 4);
  const today = dateKey(new Date());
  const todaysSessions = requests.filter((request) => request.status === "Accepted" && request.requested_date === today).slice(0, 4);

  async function respondToRequest(requestId: string, status: "Accepted" | "Declined") {
    if (!profile || respondingId) return;
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
    setRequests((current) => current.map((request) => request.id === requestId ? { ...request, status } : request));
  }

  if (state === "error") return (
    <main className={styles.content}>
      <p className={styles.error} role="alert">We couldn't load your volunteer dashboard data. Check that the volunteer dashboard migration has been applied, then try again.</p>
      <button className={styles.retryButton} type="button" onClick={() => setAttempt((value) => value + 1)}>Retry</button>
    </main>
  );

  return (
    <main className={styles.content}>
      <section className={styles.metrics} aria-label="Volunteer statistics">
        <Metric label="New requests" value={state === "loading" ? "…" : String(metrics.newRequests)} />
        <Metric label="Sessions this week" value={state === "loading" ? "…" : String(metrics.sessionsThisWeek)} />
        <Metric label="Average rating" value={state === "loading" ? "…" : metrics.averageRating} />
        <Metric label="Sessions completed" value={state === "loading" ? "…" : String(metrics.sessionsCompleted)} />
      </section>

      <div className={styles.columns}>
        <section>
          <h2 className={styles.sectionTitle}>New Requests</h2>
          {actionError && <p className={styles.error} role="alert">{actionError}</p>}
          {state === "loading" ? <p className={styles.empty}>Loading your requests…</p> : newRequests.length ? (
            <ul className={styles.list}>
              {newRequests.map((request) => <li className={styles.requestCard} key={request.id}>
                <div><strong>{request.requester_name}</strong><span>{request.title} · {formatDate(request.requested_date)}, {request.requested_time.slice(0, 5)} · {request.support_mode ?? "Support"}</span></div>
                <div className={styles.requestActions}>
                  <span className={styles.category}>{request.category}</span>
                  <button type="button" className={styles.acceptButton} disabled={respondingId !== null} onClick={() => respondToRequest(request.id, "Accepted")}>{respondingId === request.id ? "…" : "Accept"}</button>
                  <button type="button" className={styles.declineButton} disabled={respondingId !== null} onClick={() => respondToRequest(request.id, "Declined")}>Decline</button>
                </div>
              </li>)}
            </ul>
          ) : <p className={styles.empty}>No new requests right now.</p>}
        </section>

        <section>
          <h2 className={styles.sectionTitle}>Today&apos;s sessions</h2>
          {state === "loading" ? <p className={styles.empty}>Loading your sessions…</p> : todaysSessions.length ? (
            <ul className={styles.list}>
              {todaysSessions.map((request) => <li className={styles.sessionCard} key={request.id}>
                <span>{request.title} · {request.requested_time.slice(0, 5)} · {request.support_mode ?? "Support"}</span>
                <span className={styles.status}>{request.status}</span>
              </li>)}
            </ul>
          ) : <p className={styles.empty}>No sessions scheduled for today.</p>}
        </section>
      </div>

      <UpcomingSessionsSection />
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <article className={styles.metricCard}><span>{label}</span><strong>{value}</strong></article>;
}
