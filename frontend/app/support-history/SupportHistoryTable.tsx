"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/lib/useCurrentUser";
import styles from "./support-history.module.css";

type HistoryStatus = "Completed" | "Cancelled";
type HistoryRow = {
  id: string;
  title: string;
  category: string;
  requested_date: string;
  volunteer_id: string | null;
  volunteer_name: string | null;
  status: HistoryStatus;
  rating: number | null;
  feedbackCount: number;
};

function formatDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(date);
}

export default function SupportHistoryTable() {
  const { profile } = useCurrentUser();
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    async function loadHistory() {
      setLoading(true);
      setError("");
      const { data, error: queryError } = await supabase
        .from("support_request")
        .select("request_id, title, category, requested_date, volunteer_id, status, session(session_id, feedback(rating))")
        .eq("requester_id", profile!.user_id)
        .in("status", ["Completed", "Cancelled"])
        .order("requested_date", { ascending: false });

      if (cancelled) return;
      if (queryError) {
        setError("We couldn't load your support history. Please try again later.");
        setLoading(false);
        return;
      }

      const history = data ?? [];
      const volunteerIds = [...new Set(history.map((row) => row.volunteer_id).filter((id): id is string => Boolean(id)))];
      const { data: volunteers, error: volunteerError } = volunteerIds.length
        ? await supabase.from("users").select("user_id, name").in("user_id", volunteerIds)
        : { data: [], error: null };

      if (cancelled) return;
      if (volunteerError) {
        setError("We couldn't load volunteer names for your history.");
        setLoading(false);
        return;
      }

      const names = new Map((volunteers ?? []).map((volunteer) => [volunteer.user_id, volunteer.name]));
      setRows(history.map((row) => {
        const ratings = (row.session ?? []).flatMap((session) =>
          (session.feedback ?? []).map((item) => Number(item.rating))
        );
        return {
          ...row,
          id: row.request_id,
          status: row.status as HistoryStatus,
          rating: ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : null,
          feedbackCount: ratings.length,
          volunteer_name: row.volunteer_id ? names.get(row.volunteer_id) ?? null : null,
        };
      }));
      setLoading(false);
    }

    loadHistory();
    return () => { cancelled = true; };
  }, [profile]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return rows;
    return rows.filter((row) => [row.title, row.category, row.volunteer_name ?? "", row.requested_date, row.status]
      .some((value) => value.toLocaleLowerCase().includes(term)));
  }, [rows, search]);

  return (
    <main className={styles.content}>
      <label className={styles.searchLabel} htmlFor="support-history-search">Search or filter by category</label>
      <input
        id="support-history-search"
        className={styles.search}
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search or filter by category"
      />

      {error && <p className={styles.error} role="alert">{error}</p>}
      {loading ? <div className={styles.message}>Loading your support history…</div> : filteredRows.length === 0 ? (
        <div className={styles.message}>{rows.length ? "No history matches your search." : "Completed or cancelled support requests will appear here."}</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr>
              <th scope="col">Session</th>
              <th scope="col">Volunteer</th>
              <th scope="col">Date</th>
              <th scope="col">Your rating</th>
              <th scope="col">Status</th>
            </tr></thead>
            <tbody>
              {filteredRows.map((row) => <tr key={row.id}>
                <td className={styles.sessionTitle}>{row.title}</td>
                <td>{row.volunteer_name ?? "—"}</td>
                <td>{formatDate(row.requested_date)}</td>
                <td>
                  {row.rating !== null ? (
                    <span className={styles.ratingStars} aria-label={`Average session feedback: ${row.rating.toFixed(1)} out of 5`}>
                      {row.rating.toFixed(1)} / 5 ({row.feedbackCount})
                    </span>
                  ) : <span aria-label="No feedback">—</span>}
                </td>
                <td><span className={`${styles.status} ${row.status === "Completed" ? styles.statusCompleted : styles.statusCancelled}`}>{row.status}</span></td>
              </tr>)}
            </tbody>
          </table>
        </div>
      )}
      <p className={styles.ratingNote}>Ratings shown here come from feedback submitted for sessions linked to each request.</p>
    </main>
  );
}
