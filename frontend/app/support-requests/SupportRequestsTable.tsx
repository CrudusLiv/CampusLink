"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/lib/useCurrentUser";
import RequestStatusBadge from "@/components/support-requests/RequestStatusBadge";
import SupportRequestSuccessToast from "@/components/support-requests/SupportRequestSuccessToast";
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
  volunteer_assigned_at: string | null;
  assignment_version: number;
  has_current_no_response: boolean;
  status: SupportRequestStatus;
};

const FILTERS = ["All", "Pending", "Accepted", "Cancelled", "Declined"] as const;
type Filter = (typeof FILTERS)[number];
type ActionMenuState = { requestId: string; left: number; top: number };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(value));
}

export default function SupportRequestsTable({ showSubmittedToast = false, showVolunteerChangedToast = false }: { showSubmittedToast?: boolean; showVolunteerChangedToast?: boolean }) {
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
    if (!showSubmittedToast && !showVolunteerChangedToast) return;
    const timer = setTimeout(() => router.replace("/support-requests", { scroll: false }), showVolunteerChangedToast ? 3000 : 2000);
    return () => clearTimeout(timer);
  }, [router, showSubmittedToast, showVolunteerChangedToast]);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    async function loadRequests() {
      setLoading(true);
      setError("");
      const { data, error: queryError } = await supabase
        .from("support_request")
        .select("request_id, title, description, category, created_at, requested_date, requested_time, support_mode, volunteer_id, volunteer_assigned_at, assignment_version, status")
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
      const requestIds = rows.map((row) => row.request_id);
      const [{ data: volunteers, error: volunteerError }, { data: reminders, error: reminderError }] = await Promise.all([
        volunteerIds.length
          ? supabase.from("users").select("user_id, name").in("user_id", volunteerIds)
          : Promise.resolve({ data: [], error: null }),
        requestIds.length
          ? supabase.from("notification").select("request_id, event_key").eq("type", "request_no_response").in("request_id", requestIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (cancelled) return;
      if (volunteerError) {
        setError("We couldn't load volunteer names for your requests.");
        setLoading(false);
        return;
      }
      if (reminderError) {
        setError("We couldn't load response reminders for your requests.");
        setLoading(false);
        return;
      }

      const volunteerNames = new Map((volunteers ?? []).map((volunteer) => [volunteer.user_id, volunteer.name]));
      const reminderKeys = new Set((reminders ?? []).map((notice) => `${notice.request_id}:${notice.event_key}`));
      setRequests(rows.map((row) => ({
        ...row,
        id: row.request_id,
        status: row.status as SupportRequestStatus,
        volunteer_name: row.volunteer_id ? volunteerNames.get(row.volunteer_id) ?? null : null,
        has_current_no_response: reminderKeys.has(`${row.request_id}:request:${row.request_id}:no-response:${row.assignment_version}`),
      })));
      setLoading(false);
    }

    loadRequests();
    return () => { cancelled = true; };
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    const channel = supabase.channel(`support-request-actions:${profile.user_id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "notification", filter: `user_id=eq.${profile.user_id}`,
      }, (payload) => {
        const notice = payload.new as { type?: string; request_id?: string | null; event_key?: string | null };
        if (notice.type !== "request_no_response" || !notice.request_id || !notice.event_key) return;
        setRequests((current) => current.map((request) => request.id === notice.request_id
          && notice.event_key === `request:${request.id}:no-response:${request.assignment_version}`
          ? { ...request, has_current_no_response: true } : request));
      })
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "support_request", filter: `requester_id=eq.${profile.user_id}`,
      }, (payload) => {
        const updated = payload.new as { request_id?: string; status?: SupportRequestStatus; assignment_version?: number };
        if (!updated.request_id) return;
        setRequests((current) => current.map((request) => request.id !== updated.request_id ? request : {
          ...request,
          status: updated.status ?? request.status,
          assignment_version: updated.assignment_version ?? request.assignment_version,
          has_current_no_response: updated.assignment_version !== undefined && updated.assignment_version !== request.assignment_version
            ? false : request.has_current_no_response,
        }));
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
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
    {showSubmittedToast && <SupportRequestSuccessToast title="Your support request was submitted successfully." />}
    {showVolunteerChangedToast && <SupportRequestSuccessToast title="Volunteer Changed Successfully!" description="Your support request has been successfully assigned to the new volunteer." />}
    <p className={styles.message}>Loading requests…</p>
  </main>;

  return (
    <main className={styles.content}>
      {showSubmittedToast && <SupportRequestSuccessToast title="Your support request was submitted successfully." />}
      {showVolunteerChangedToast && <SupportRequestSuccessToast title="Volunteer Changed Successfully!" description="Your support request has been successfully assigned to the new volunteer." />}
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
                    >Actions <span aria-hidden="true">▾</span>{request.status === "Pending" && request.has_current_no_response && <span className={styles.alertIndicator} aria-label="No response for 24 hours">!</span>}</button>
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
          {requests.find((request) => request.id === actionMenu.requestId)?.status === "Pending" ? <>
            <Link role="menuitem" href={`/support-requests/${actionMenu.requestId}?mode=view`} onClick={closeActionMenu}>View</Link>
            <Link role="menuitem" href={`/support-requests/${actionMenu.requestId}?mode=edit`} onClick={closeActionMenu}>Edit</Link>
            {requests.find((request) => request.id === actionMenu.requestId)?.has_current_no_response && <Link role="menuitem" className={styles.changeVolunteerItem} href={`/support-requests/${actionMenu.requestId}?mode=change-volunteer`} onClick={closeActionMenu}>Change Volunteer<span className={styles.alertIndicator} aria-label="No response for 24 hours">!</span></Link>}
            <button
              type="button"
              role="menuitem"
              disabled={cancellingId === actionMenu.requestId}
              onClick={() => {
                const target = requests.find((request) => request.id === actionMenu.requestId);
                closeActionMenu();
                if (target) { setCancelTarget(target); setError(""); }
              }}
            >Cancel</button>
          </> : <Link role="menuitem" href={`/support-requests/${actionMenu.requestId}?mode=view`} onClick={closeActionMenu}>View</Link>}
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
