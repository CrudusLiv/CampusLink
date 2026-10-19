"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/lib/useCurrentUser";
import RequestStatusBadge from "@/components/support-requests/RequestStatusBadge";
import {
  loadVolunteerRequests,
  type VolunteerRequestItem,
} from "@/lib/support-requests/volunteer-requests";
import styles from "../../support-history/support-history.module.css";

const FILTERS = ["All", "Completed", "Cancelled", "Declined"] as const;
type StatusFilter = (typeof FILTERS)[number];

function formatDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(date);
}

export default function VolunteerHistoryTable() {
  const { profile } = useCurrentUser();
  const [rows, setRows] = useState<VolunteerRequestItem[]>([]);
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
      const result = await loadVolunteerRequests(supabase, "history", profile!.user_id);
      if (cancelled) return;

      if (result.error === "requests") {
        setError("We couldn't load your support history. Please try again later.");
        setLoading(false);
        return;
      }
      if (result.error === "requesters") {
        setError("We couldn't load student names for your history.");
        setLoading(false);
        return;
      }

      setRows(result.items);
      setLoading(false);
    }

    loadHistory();
    return () => { cancelled = true; };
  }, [profile]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return rows.filter((row) => {
      const matchesStatus = statusFilter === "All" || row.status === statusFilter;
      const matchesSearch = !term || [row.title, row.category, row.requester_name, row.requested_date, row.status]
        .some((value) => value.toLocaleLowerCase().includes(term));
      return matchesStatus && matchesSearch;
    });
  }, [rows, search, statusFilter]);

  return (
    <main className={styles.content}>
      <label className={styles.searchLabel} htmlFor="volunteer-history-search">Search or filter by category</label>
      <input
        id="volunteer-history-search"
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
              <th scope="col">Student</th>
              <th scope="col">Date</th>
              <th scope="col">Status</th>
            </tr></thead>
            <tbody>
              {filteredRows.map((row) => <tr key={row.id}>
                <td className={styles.sessionTitle}>{row.title}</td>
                <td>{row.requester_name}</td>
                <td>{formatDate(row.requested_date)}</td>
                <td><RequestStatusBadge status={row.status} /></td>
              </tr>)}
            </tbody>
          </table>
        </div>
      )}
      <p className={styles.ratingNote}>Your completed support requests and their status appear here.</p>
    </main>
  );
}
