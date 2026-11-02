"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/lib/useCurrentUser";
import RequestStatusBadge from "@/components/support-requests/RequestStatusBadge";
import styles from "./support-history.module.css";
import { loadStudentSupportHistory, type StudentHistoryRow } from "@/lib/support-requests/student-history";

const FILTERS = ["All", "Completed", "Cancelled", "Declined"] as const;
type StatusFilter = (typeof FILTERS)[number];

function formatDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(date);
}

export default function SupportHistoryTable() {
  const { profile } = useCurrentUser();
  const [rows, setRows] = useState<StudentHistoryRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    async function loadHistory() {
      setLoading(true);
      setError("");
      const result = await loadStudentSupportHistory(supabase, profile!.user_id);

      if (cancelled) return;

      if (result.error === "history") {
        setError("We couldn't load your support history. Please try again later.");
        setLoading(false);
        return;
      }

      if (result.error === "volunteers") {
        setError("We couldn't load volunteer names for your history.");
        setLoading(false);
        return;
      }

      setRows(result.rows);
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
                  ) : row.status === "Completed" && row.session_id ? (
                    <Link className={styles.rateLink} href={`/sessions/${row.session_id}`}>Rate this session</Link>
                  ) : <span aria-label="No rating">—</span>}
                </td>
                <td><RequestStatusBadge status={row.status} /></td>
              </tr>)}
            </tbody>
          </table>
        </div>
      )}
      <p className={styles.ratingNote}>You can rate a completed session once, from its session page. Ratings cannot be changed afterwards.</p>
    </main>
  );
}
