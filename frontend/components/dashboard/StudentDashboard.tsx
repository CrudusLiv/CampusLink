"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, CheckCircle2, Clock3, LoaderCircle, UserRound, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/lib/useCurrentUser";

type RequestStatus = "Pending" | "Accepted" | "Declined" | "Rejected" | "Completed" | "Cancelled";
type RequestRow = {
  request_id: string;
  title: string;
  status: RequestStatus;
  support_mode: string | null;
  volunteer_id: string | null;
  created_at: string;
  requested_date: string;
  requested_time: string;
};
type SessionRow = { request_id: string; scheduled_datetime: string; support_mode: string | null; status: string };
type VolunteerRow = { user_id: string; name: string };

const dateFormat = new Intl.DateTimeFormat("en-MY", { timeZone: "Asia/Kuala_Lumpur", weekday: "long", day: "numeric", month: "long" });
const compactDateFormat = new Intl.DateTimeFormat("en-MY", { timeZone: "Asia/Kuala_Lumpur", day: "numeric", month: "short", year: "numeric" });
const timeFormat = new Intl.DateTimeFormat("en-MY", { timeZone: "Asia/Kuala_Lumpur", hour: "2-digit", minute: "2-digit", hour12: true });
const startTime = (iso: string) => timeFormat.format(new Date(iso)).toUpperCase();
const timeRange = (iso: string) => `${startTime(iso)} – ${timeFormat.format(new Date(new Date(iso).getTime() + 60 * 60 * 1000)).toUpperCase()}`;

function StatusBadge({ status }: { status: RequestStatus }) {
  const colors = status === "Accepted" || status === "Completed"
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : status === "Declined" || status === "Rejected"
      ? "bg-rose-50 text-rose-700 ring-rose-200"
      : status === "Cancelled"
        ? "bg-slate-100 text-slate-600 ring-slate-200"
        : "bg-amber-50 text-amber-700 ring-amber-200";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${colors}`}>{status}</span>;
}

export default function StudentDashboard() {
  const { profile } = useCurrentUser();
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [volunteers, setVolunteers] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError("");
    const { data, error: requestError } = await supabase.from("support_request")
      .select("request_id, title, status, support_mode, volunteer_id, created_at, requested_date, requested_time")
      .eq("requester_id", profile.user_id).order("created_at", { ascending: false });
    if (requestError) { setError("We couldn't load your dashboard. Please try again."); setLoading(false); return; }
    const rows = (data ?? []) as RequestRow[];
    const ids = rows.map((row) => row.request_id);
    const volunteerIds = [...new Set(rows.map((row) => row.volunteer_id).filter((id): id is string => Boolean(id)))];
    const [sessionResult, volunteerResult] = await Promise.all([
      ids.length ? supabase.from("session").select("request_id, scheduled_datetime, support_mode, status").in("request_id", ids).eq("status", "Scheduled").gte("scheduled_datetime", new Date().toISOString()).order("scheduled_datetime", { ascending: true }) : Promise.resolve({ data: [], error: null }),
      volunteerIds.length ? supabase.from("users").select("user_id, name").in("user_id", volunteerIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (sessionResult.error || volunteerResult.error) {
      setError("We couldn't load your upcoming session details. Please try again."); setLoading(false); return;
    }
    setRequests(rows);
    setSessions((sessionResult.data ?? []) as SessionRow[]);
    setVolunteers(new Map(((volunteerResult.data ?? []) as VolunteerRow[]).map((row) => [row.user_id, row.name])));
    setLoading(false);
  }, [profile]);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  const nearest = useMemo(() => sessions.find((session) => requests.some((request) => request.request_id === session.request_id && request.status === "Accepted")), [sessions, requests]);
  const nearestRequest = nearest && requests.find((request) => request.request_id === nearest.request_id);
  const counts = {
    pending: requests.filter((request) => request.status === "Pending").length,
    upcoming: requests.filter((request) => request.status === "Accepted").length,
    completed: requests.filter((request) => request.status === "Completed").length,
  };

  async function cancelRequest(requestId: string) {
    setBusyId(requestId);
    const { error: cancelError } = await supabase.from("support_request").update({ status: "Cancelled" }).eq("request_id", requestId).eq("status", "Pending");
    if (cancelError) setError("We couldn't cancel this request. Please try again.");
    else setRequests((current) => current.map((request) => request.request_id === requestId ? { ...request, status: "Cancelled" } : request));
    setBusyId(null);
  }

  const metrics = [
    { label: "Pending Requests", value: counts.pending, icon: Clock3, tone: "border-amber-200 bg-amber-50 text-amber-800" },
    { label: "Upcoming Sessions", value: counts.upcoming, icon: CalendarDays, tone: "border-blue-200 bg-blue-50 text-blue-800" },
    { label: "Completed Sessions", value: counts.completed, icon: CheckCircle2, tone: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  ];

  return <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
    <section aria-label="Request summary" className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {metrics.map(({ label, value, icon: Icon, tone }) => <article key={label} className={`rounded-2xl border p-5 shadow-sm ${tone}`}>
        <div className="flex items-center justify-between"><p className="text-sm font-medium">{label}</p><Icon aria-hidden="true" className="h-5 w-5 opacity-80" /></div>
        <p className="mt-3 text-4xl font-bold tracking-tight" aria-live="polite">{loading ? <LoaderCircle className="h-8 w-8 animate-spin" aria-label="Loading" /> : value}</p>
      </article>)}
    </section>

    <section aria-labelledby="upcoming-heading">
      <div className="mb-3 flex items-center justify-between"><div><h2 id="upcoming-heading" className="text-xl font-bold text-slate-900">Your next session</h2><p className="mt-1 text-sm text-slate-500">A quick look at what’s coming up.</p></div></div>
      {loading ? <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-6 text-slate-500"><LoaderCircle className="h-5 w-5 animate-spin" />Loading your schedule…</div>
        : nearest && nearestRequest ? <article className="rounded-2xl border-2 border-blue-200 bg-white p-5 shadow-md shadow-blue-100/70 sm:p-7">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div><span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700"><CalendarDays className="h-4 w-4" />UPCOMING</span>
              <h3 className="mt-3 text-xl font-bold text-slate-900">{nearestRequest.title}</h3>
              <p className="mt-1 text-slate-600">{dateFormat.format(new Date(nearest.scheduled_datetime))}</p>
              <p className="mt-2 flex items-center gap-2 font-semibold text-slate-800"><Clock3 aria-hidden="true" className="h-4 w-4 text-blue-700" />{timeRange(nearest.scheduled_datetime)}</p>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4 sm:min-w-64">
              <div aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700"><UserRound className="h-5 w-5" /></div>
              <div><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Volunteer</p><p className="font-semibold text-slate-900">{nearestRequest.volunteer_id ? volunteers.get(nearestRequest.volunteer_id) ?? "Your volunteer" : "Your volunteer"}</p><p className="mt-0.5 text-sm text-slate-600">{nearest.support_mode ?? nearestRequest.support_mode ?? "Support session"}</p></div>
            </div>
          </div>
        </article>
        : <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-slate-700"><p className="font-semibold">No upcoming sessions today</p><p className="mt-1 text-sm text-slate-600">Check your pending requests or ask for support.</p><Link href="/sessions/ask-for-support" className="mt-3 inline-flex text-sm font-semibold text-blue-700 underline-offset-4 hover:underline">Ask for support</Link></div>}
    </section>

    <section aria-labelledby="recent-heading" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6"><h2 id="recent-heading" className="text-xl font-bold text-slate-900">Recent support requests</h2><p className="mt-1 text-sm text-slate-500">Your latest activity and request status.</p></div>
      {error && <div role="alert" className="mx-5 mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700 sm:mx-6">{error} <button type="button" onClick={() => void loadDashboard()} className="ml-1 font-semibold underline">Retry</button></div>}
      {loading ? <p className="px-5 py-8 text-sm text-slate-500 sm:px-6">Loading requests…</p>
        : requests.length ? <ul className="divide-y divide-slate-100">{requests.slice(0, 5).map((request) => <li key={request.request_id} className="flex flex-wrap items-center gap-3 px-5 py-4 sm:flex-nowrap sm:px-6">
          <div className="min-w-0 flex-1"><Link href={`/support-requests/${request.request_id}?mode=view`} className="truncate font-semibold text-slate-900 hover:text-blue-700 hover:underline">{request.title}</Link><p className="mt-1 text-sm text-slate-500">Submitted {compactDateFormat.format(new Date(request.created_at))}</p></div>
          <StatusBadge status={request.status} />
          {request.status === "Pending" && <button type="button" disabled={busyId === request.request_id} onClick={() => void cancelRequest(request.request_id)} aria-label={`Cancel ${request.title}`} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"><X className="h-4 w-4" />{busyId === request.request_id ? "Cancelling…" : "Cancel"}</button>}
        </li>)}</ul> : <p className="px-5 py-8 text-sm text-slate-500 sm:px-6">No support requests yet. <Link className="font-semibold text-blue-700 underline" href="/sessions/ask-for-support">Ask for support</Link>.</p>}
      <div className="border-t border-slate-100 px-5 py-4 sm:px-6"><Link href="/history" className="text-sm font-semibold text-blue-700 hover:underline">View All History <span aria-hidden="true">→</span></Link></div>
    </section>
  </main>;
}
