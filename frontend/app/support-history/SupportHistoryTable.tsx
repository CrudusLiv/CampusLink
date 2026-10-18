"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/lib/useCurrentUser";
import RequestStatusBadge from "@/components/support-requests/RequestStatusBadge";
import { supportHistoryQuery, type SupportRequestStatus } from "@/lib/support-requests/history";
import styles from "./support-history.module.css";

type HistoryRow = {
  id: string;
  title: string;
  category: string;
  requested_date: string;
  volunteer_id: string | null;
  volunteer_name: string | null;
  status: SupportRequestStatus;
  rating: number | null;
};

const FILTERS = ["All", "Completed", "Cancelled", "Declined"] as const;
type StatusFilter = (typeof FILTERS)[number];

function formatDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(date);
}

export default function SupportHistoryTable() {
  const { profile } = useCurrentUser();
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingRatingId, setSavingRatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    async function loadHistory() {
      setLoading(true);
      setError("");
      const query = supportHistoryQuery("student", profile!.user_id);
      const { data, error: queryError } = await supabase
        .from("support_request")
        .select("request_id, title, category, requested_date, volunteer_id, status")
        .eq(query.ownerColumn, query.ownerId)
        .in("status", [...query.statuses])
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
      setRows(history.map((row) => ({
        ...row,
        id: row.request_id,
        status: row.status as SupportRequestStatus,
        rating: null, // ratings now live in the feedback table, not on support_request
        volunteer_name: row.volunteer_id ? names.get(row.volunteer_id) ?? null : null,
      })));
      setLoading(false);
    }

    loadHistory();
    return () => { cancelled = true; };
  }, [profile]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return rows.filter((row) => {
      const matchesStatus = statusFilter === "All" || row.status === statusFilter;
      const matchesSearch = !term || [row.title, row.category, row.volunteer_name ?? "", row.requested_date, row.status]
        .some((value) => value.toLocaleLowerCase().includes(term));
      return matchesStatus && matchesSearch;
    });
  }, [rows, search, statusFilter]);

  async function saveRating(row: HistoryRow, rating: number) {
    if (!profile || savingRatingId) return;
    setSavingRatingId(row.id);
    setError("");
    const { data, error: saveError } = await supabase
      .from("support_request")
      .update({ rating })
      .eq("request_id", row.id)
      .eq("requester_id", profile.user_id)
      .eq("status", "Completed")
      .select("request_id")
      .maybeSingle();
    setSavingRatingId(null);
    if (saveError || !data) {
      setError("We couldn't save your rating. Make sure the support history migration has been applied.");
      return;
    }
    setRows((current) => current.map((item) => item.id === row.id ? { ...item, rating } : item));
  }

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

      <div className={styles.filters} role="group" aria-label="Filter support history by status">
        {FILTERS.map((item) => <button
          key={item}
          type="button"
          className={statusFilter === item ? `${styles.filterButton} ${styles.filterActive}` : styles.filterButton}
          aria-pressed={statusFilter === item}
          onClick={() => setStatusFilter(item)}
        >{item}</button>)}
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}
      {loading ? <div className={styles.message}>Loading your support history…</div> : filteredRows.length === 0 ? (
        <div className={styles.message}>{rows.length ? "No history matches your search." : "Your support requests will appear here."}</div>
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
                  {row.rating ? (
                    <span className={styles.ratingStars} aria-label={`Your rating: ${row.rating} out of 5`}>
                      {Array.from({ length: 5 }, (_, index) => index < row.rating! ? "★" : "☆").join("")}
                    </span>
                  ) : row.status === "Completed" ? (
                    <span className={styles.ratingPicker} role="group" aria-label={`Rate ${row.title}`}>
                      {[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" aria-label={`${value} star${value === 1 ? "" : "s"}`} disabled={savingRatingId !== null} onClick={() => saveRating(row, value)}>
                        {savingRatingId === row.id ? "…" : "☆"}
                      </button>)}
                    </span>
                  ) : <span aria-label="No rating">—</span>}
                </td>
                <td><RequestStatusBadge status={row.status} /></td>
              </tr>)}
            </tbody>
          </table>
        </div>
      )}
      <p className={styles.ratingNote}>Ratings will appear here when session feedback is available.</p>
    </main>
  );
}
