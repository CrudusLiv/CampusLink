"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/lib/useCurrentUser";
import RequestStatusBadge from "@/components/support-requests/RequestStatusBadge";
import type { SupportRequestStatus } from "@/lib/support-requests/history";
import styles from "./support-requests.module.css";

type RequestRow = {
  id: string;
  title: string;
  description: string;
  category: string;
  created_at: string;
  requested_date: string;
  requested_time: string;
  support_mode: string | null;
  volunteer_id: string | null;
  volunteer_name: string | null;
  status: SupportRequestStatus;
};

const FILTERS = ["All", "Pending", "Accepted", "Cancelled", "Declined"] as const;
type Filter = (typeof FILTERS)[number];
type ActionMenuState = { requestId: string; left: number; top: number };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(value));
}

export default function SupportRequestsTable({ showSubmittedToast = false }: { showSubmittedToast?: boolean }) {
  const router = useRouter();
  const { profile } = useCurrentUser();
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [filter, setFilter] = useState<Filter>("All");
  const [actionMenu, setActionMenu] = useState<ActionMenuState | null>(null);
  const actionButtonRef = useRef<HTMLButtonElement | null>(null);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const [cancelTarget, setCancelTarget] = useState<RequestRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!showSubmittedToast) return;
    const timer = setTimeout(() => router.replace("/support-requests", { scroll: false }), 2000);
    return () => clearTimeout(timer);
  }, [router, showSubmittedToast]);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    async function loadRequests() {
      setLoading(true);
      setError("");
      const { data, error: queryError } = await supabase
        .from("support_request")
        .select("request_id, title, description, category, created_at, requested_date, requested_time, support_mode, volunteer_id, status")
        .eq("requester_id", profile!.user_id)
        .order("created_at", { ascending: false });

      if (cancelled) return;
      if (queryError) {
        setError("We couldn't load your requests. Please try again later.");
        setLoading(false);
        return;
      }

      const rows = data ?? [];
      const volunteerIds = [...new Set(rows.map((row) => row.volunteer_id).filter((id): id is string => Boolean(id)))];
      const { data: volunteers, error: volunteerError } = volunteerIds.length
        ? await supabase.from("users").select("user_id, name").in("user_id", volunteerIds)
        : { data: [], error: null };

      if (cancelled) return;
      if (volunteerError) {
        setError("We couldn't load volunteer names for your requests.");
        setLoading(false);
        return;
      }

      const volunteerNames = new Map((volunteers ?? []).map((volunteer) => [volunteer.user_id, volunteer.name]));
      setRequests(rows.map((row) => ({
        ...row,
        id: row.request_id,
        status: row.status as SupportRequestStatus,
        volunteer_name: row.volunteer_id ? volunteerNames.get(row.volunteer_id) ?? null : null,
      })));
      setLoading(false);
    }

    loadRequests();
    return () => { cancelled = true; };
  }, [profile]);

  const visibleRequests = useMemo(
    () => filter === "All" ? requests : requests.filter((request) => request.status === filter),
    [filter, requests],
  );

  function toggleActionMenu(event: React.MouseEvent<HTMLButtonElement>, requestId: string) {
    if (actionMenu?.requestId === requestId) {
      setActionMenu(null);
      actionButtonRef.current = null;
      return;
    }
    const button = event.currentTarget;
    actionButtonRef.current = button;
    const rect = button.getBoundingClientRect();
    const menuWidth = 144;
    const menuHeight = 136;
    const opensBelow = rect.bottom + menuHeight + 4 <= window.innerHeight;
    setActionMenu({
      requestId,
      left: Math.min(Math.max(8, rect.right - menuWidth), Math.max(8, window.innerWidth - menuWidth - 8)),
      top: opensBelow ? rect.bottom + 4 : Math.max(8, rect.top - menuHeight - 4),
    });
  }

  useEffect(() => {
    if (!actionMenu) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!actionButtonRef.current?.contains(target) && !actionMenuRef.current?.contains(target)) {
        setActionMenu(null);
        actionButtonRef.current = null;
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActionMenu(null);
        actionButtonRef.current?.focus();
        actionButtonRef.current = null;
      }
    };
    const repositionMenu = () => {
      const rect = actionButtonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const menuWidth = 144;
      const menuHeight = 136;
      const opensBelow = rect.bottom + menuHeight + 4 <= window.innerHeight;
      setActionMenu((current) => current ? {
        ...current,
        left: Math.min(Math.max(8, rect.right - menuWidth), Math.max(8, window.innerWidth - menuWidth - 8)),
        top: opensBelow ? rect.bottom + 4 : Math.max(8, rect.top - menuHeight - 4),
      } : current);
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", repositionMenu);
    window.addEventListener("scroll", repositionMenu, true);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", repositionMenu);
      window.removeEventListener("scroll", repositionMenu, true);
    };
  }, [actionMenu]);

  function closeActionMenu() {
    setActionMenu(null);
    actionButtonRef.current = null;
  }

  async function cancelRequest(requestId: string) {
    setCancellingId(requestId);
    setError("");
    const { data: cancelledRequest, error: cancelError } = await supabase
      .from("support_request")
      .update({ status: "Cancelled" })
      .eq("request_id", requestId)
      .eq("requester_id", profile?.user_id)
      .eq("status", "Pending")
      .select("request_id")
      .maybeSingle();
    setCancellingId(null);

    if (cancelError || !cancelledRequest) {
      setError("We couldn't cancel this request. It may no longer be pending.");
      return false;
    }
    setRequests((current) => current.map((request) => request.id === requestId ? { ...request, status: "Cancelled" } : request));
    return true;
  }

  if (!profile) return <main className={styles.content}>
    {showSubmittedToast && <div className={styles.successToast} role="status" aria-live="polite"><span className={styles.successToastCheck} aria-hidden="true">✓</span><span>Your support request was submitted successfully.</span></div>}
    <p className={styles.message}>Loading requests…</p>
  </main>;

  return (
    <main className={styles.content}>
      {showSubmittedToast && <div className={styles.successToast} role="status" aria-live="polite"><span className={styles.successToastCheck} aria-hidden="true">✓</span><span>Your support request was submitted successfully.</span></div>}
      <div className={styles.filters} role="group" aria-label="Filter requests by status">
        {FILTERS.map((item) => <button
          key={item}
          type="button"
          className={filter === item ? `${styles.filterButton} ${styles.filterActive}` : styles.filterButton}
          aria-pressed={filter === item}
          onClick={() => setFilter(item)}
        >{item}</button>)}
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}
      {loading ? <div className={styles.message}>Loading your requests…</div> : visibleRequests.length === 0 ? (
        <div className={styles.message}>{requests.length ? "No requests match this status." : "You haven't submitted any support requests yet."}</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr>
              <th scope="col">Request</th><th scope="col">Category</th><th scope="col">Submitted</th>
              <th scope="col">Volunteer</th><th scope="col">Status</th><th scope="col">Action</th>
            </tr></thead>
            <tbody>
              {visibleRequests.map((request) => <tr key={request.id}>
                  <td className={styles.requestTitle}>{request.title}</td>
                  <td>{request.category}</td>
                  <td>{formatDate(request.created_at)}</td>
                  <td>{request.volunteer_name ?? "—"}</td>
                  <td><RequestStatusBadge status={request.status} /></td>
                  <td className={styles.actionCell}>
                    <button
                      type="button"
                      className={styles.actionButton}
                      aria-haspopup="menu"
                      aria-expanded={actionMenu?.requestId === request.id}
                      onClick={(event) => toggleActionMenu(event, request.id)}
                    >Actions ▾</button>
                  </td>
                </tr>)}
            </tbody>
          </table>
        </div>
      )}

      {actionMenu && typeof document !== "undefined" && createPortal(
        <div
          ref={actionMenuRef}
          className={styles.actionMenu}
          role="menu"
          aria-label={`Actions for ${requests.find((request) => request.id === actionMenu.requestId)?.title ?? "support request"}`}
          style={{ left: actionMenu.left, top: actionMenu.top }}
        >
          <Link role="menuitem" href={`/support-requests/${actionMenu.requestId}?mode=view`} onClick={closeActionMenu}>View</Link>
          {requests.find((request) => request.id === actionMenu.requestId)?.status === "Pending" ? (
            <Link role="menuitem" href={`/support-requests/${actionMenu.requestId}?mode=edit`} onClick={closeActionMenu}>Edit</Link>
          ) : <button type="button" role="menuitem" disabled>Edit</button>}
          <button
            type="button"
            role="menuitem"
            disabled={requests.find((request) => request.id === actionMenu.requestId)?.status !== "Pending" || cancellingId === actionMenu.requestId}
            onClick={() => {
              const target = requests.find((request) => request.id === actionMenu.requestId);
              closeActionMenu();
              if (target) { setCancelTarget(target); setError(""); }
            }}
          >Cancel</button>
        </div>,
        document.body,
      )}

      {cancelTarget && <div className={styles.modalBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget && !cancellingId) setCancelTarget(null); }}>
        <section className={styles.confirmDialog} role="dialog" aria-modal="true" aria-labelledby="cancel-request-title">
          <h2 id="cancel-request-title">Cancel this request?</h2>
          <p>Are you sure you want to cancel <strong>{cancelTarget.title}</strong>? This action cannot be undone.</p>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <div className={styles.confirmActions}>
            <button type="button" className={styles.keepButton} disabled={Boolean(cancellingId)} onClick={() => setCancelTarget(null)}>Keep request</button>
            <button
              type="button"
              className={styles.confirmCancelButton}
              disabled={Boolean(cancellingId)}
              onClick={async () => { if (await cancelRequest(cancelTarget.id)) setCancelTarget(null); }}
            >{cancellingId === cancelTarget.id ? "Cancelling…" : "Yes, cancel request"}</button>
          </div>
        </section>
      </div>}
    </main>
  );
}
