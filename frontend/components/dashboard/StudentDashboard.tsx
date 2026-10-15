"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/lib/useCurrentUser";
import styles from "@/app/page.module.css";

type Request = {
  request_id: string;
  title: string;
  category: string;
  requested_date: string;
  requested_time: string;
  support_mode: string | null;
  volunteer_id: string | null;
  status: string;
  created_at: string;
};
type Volunteer = { user_id: string; name: string; photo_url: string | null; faculty: string | null };

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(`${date}T00:00:00`));
}
function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

export default function StudentDashboard() {
  const { profile } = useCurrentUser();
  const [requests, setRequests] = useState<Request[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      const { data, error: requestError } = await supabase.from("support_request")
        .select("request_id, title, category, requested_date, requested_time, support_mode, volunteer_id, status, created_at")
        .eq("requester_id", profile!.user_id).order("created_at", { ascending: false }).limit(3);
      if (cancelled) return;
      if (requestError) { setError("We couldn't load your dashboard. Please try again."); setLoading(false); return; }
      const rows = (data ?? []) as Request[];
      const ids = [...new Set(rows.map((r) => r.volunteer_id).filter((id): id is string => Boolean(id)))];
      const { data: people, error: peopleError } = ids.length
        ? await supabase.from("users").select("user_id, name, photo_url, faculty").in("user_id", ids)
        : { data: [], error: null };
      if (cancelled) return;
      if (peopleError) { setError("We couldn't load volunteers for your recent requests."); setLoading(false); return; }
      setRequests(rows);
      setVolunteers((people ?? []) as Volunteer[]);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [profile?.user_id, attempt]);

  const volunteerById = new Map(volunteers.map((person) => [person.user_id, person]));

  return <div className={styles.contentBody}>
    <div className={styles.actionButtons}>
      <Link className={styles.btnPrimary} href="/sessions/ask-for-support">Submit New Request</Link>
      <Link className={styles.btnSecondary} href="/volunteer-lists">Browse Volunteers</Link>
    </div>
    {error && <div role="alert" className={styles.dashboardError}>{error} <button type="button" onClick={() => setAttempt((n) => n + 1)}>Retry</button></div>}
    <div className={styles.studentGrid}>
      <section>
        <h2 className={styles.sectionTitle}>My Requests</h2>
        {loading ? <p className={styles.dashboardMessage}>Loading your recent requests...</p> : requests.length ? <div className={styles.requestList}>
          {requests.map((request) => <Link key={request.request_id} href={`/support-requests/${request.request_id}?mode=view`} className={styles.requestCard}>
            <div className={styles.requestInfo}><h4>{request.title}</h4><p>{formatDate(request.requested_date)} | {request.requested_time.slice(0, 5)} | {request.support_mode ?? "Support"}</p></div>
            <span className={`${styles.badge} ${styles[`badge${request.status}`] ?? styles.badgePending}`}>{request.status}</span>
          </Link>)}
          <Link className={styles.dashboardMore} href="/support-requests">View all support requests</Link>
        </div> : <div className={styles.dashboardMessage}>You haven&apos;t submitted any requests yet. <Link href="/sessions/ask-for-support">Ask for support</Link></div>}
      </section>
      <section>
        <h2 className={styles.sectionTitle}>Suggested Volunteers</h2>
        <p className={styles.sectionSubtitle}>Volunteers from your last 3 support requests.</p>
        {loading ? <p className={styles.dashboardMessage}>Loading suggested volunteers...</p> : requests.some((r) => r.volunteer_id) ? <div className={styles.volunteerList}>
          {[...new Map(requests.filter((r) => r.volunteer_id).map((request) => [request.volunteer_id!, request])).values()].map((request) => {
            const volunteer = volunteerById.get(request.volunteer_id!);
            const requestHref = `/sessions/ask-for-support?${new URLSearchParams({
              volunteerId: request.volunteer_id!,
              volunteerName: volunteer?.name ?? "Selected volunteer",
              category: request.category,
              ...(volunteer?.photo_url ? { volunteerPhoto: volunteer.photo_url } : {}),
            }).toString()}`;
            return <article className={styles.volunteerCard} key={request.request_id}>
              <div className={styles.volunteerInfo}>
                {volunteer?.photo_url ? <img className={styles.volunteerAvatar} src={volunteer.photo_url} alt="" /> : <div className={styles.volunteerAvatar} aria-hidden="true">{volunteer ? initials(volunteer.name) : "?"}</div>}
                <div className={styles.volunteerText}><h4>{volunteer?.name ?? "Volunteer"}</h4><p>{request.category}</p></div>
              </div>
              <Link className={styles.btnAction} href={requestHref}>Request</Link>
            </article>;
          })}
        </div> : <div className={styles.dashboardMessage}>No volunteer has been selected for your recent requests yet. <Link href="/volunteer-lists">Browse volunteers</Link></div>}
      </section>
    </div>
  </div>;
}
