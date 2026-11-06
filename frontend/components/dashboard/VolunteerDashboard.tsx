"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { formatRange, klDateKey, TZ } from "@/lib/sessions/time";

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
type DashboardSession = { session_id: string; request_id: string; scheduled_datetime: string; support_mode: string; status: string };
type DataState = "loading" | "ready" | "error";

const sessionDate = new Intl.DateTimeFormat("en-MY", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
const requestDate = new Intl.DateTimeFormat("en-MY", { timeZone: TZ, day: "numeric", month: "short" });

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

function requestedDateTime(request: DashboardRequest) {
  const iso = new Date(`${request.requested_date}T${request.requested_time.slice(0, 5)}:00+08:00`).toISOString();
  return `${requestDate.format(new Date(iso))} · ${formatRange(iso)} · ${request.support_mode ?? "Support"}`;
}

function DashboardCard({
  title,
  dateTime,
  person,
  badge,
  action,
  highlight = false,
}: {
  title: string;
  dateTime: string;
  person: string;
  badge?: ReactNode;
  action?: ReactNode;
  highlight?: boolean;
}) {
  return (
    <article className={`rounded-2xl border bg-white p-4 shadow-sm transition-colors ${highlight ? "border-blue-300 ring-1 ring-blue-100" : "border-slate-200"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="break-words font-semibold leading-6 text-slate-900">{title}</h3>
          <p className="mt-1 text-sm leading-5 text-slate-600">{dateTime}</p>
          <p className="mt-2 text-sm text-slate-500">With <span className="font-medium text-slate-700">{person}</span></p>
        </div>
        {(badge || action) && <div className="flex shrink-0 items-center gap-2">{badge}{action}</div>}
      </div>
    </article>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return <article className={`rounded-2xl border p-4 shadow-sm sm:p-5 ${color}`}>
    <p className="text-sm font-medium opacity-80">{label}</p>
    <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
  </article>;
}

export default function VolunteerDashboard() {
  const { profile } = useCurrentUser();
  const [requests, setRequests] = useState<DashboardRequest[]>([]);
  const [sessions, setSessions] = useState<DashboardSession[]>([]);
  const [ratings, setRatings] = useState<number[]>([]);
  const [state, setState] = useState<DataState>("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    async function loadDashboard() {
      setState("loading");
      const { data, error } = await supabase.from("support_request")
        .select("request_id, title, category, requested_date, requested_time, support_mode, requester_id, status")
        .eq("volunteer_id", profile!.user_id).order("requested_date", { ascending: true });
      if (cancelled) return;
      if (error) { setState("error"); return; }

      const rows = data ?? [];
      const requesterIds = [...new Set(rows.map((row) => row.requester_id))];
      const { data: requesters, error: requesterError } = requesterIds.length
        ? await supabase.from("users").select("user_id, name").in("user_id", requesterIds)
        : { data: [], error: null };
      if (cancelled) return;
      if (requesterError) { setState("error"); return; }

      const requestIds = rows.filter((row) => row.status === "Accepted").map((row) => row.request_id);
      const { data: sessionRows, error: sessionError } = requestIds.length
        ? await supabase.from("session").select("session_id, request_id, scheduled_datetime, support_mode, status").in("request_id", requestIds).eq("status", "Scheduled")
        : { data: [], error: null };
      if (cancelled) return;
      if (sessionError) { setState("error"); return; }

      const names = new Map((requesters ?? []).map((requester) => [requester.user_id, requester.name]));
      setRequests(rows.map((row) => ({
        ...row,
        id: row.request_id,
        status: String(row.status),
        requester_name: names.get(row.requester_id) ?? "Student",
      })));
      setSessions((sessionRows ?? []) as DashboardSession[]);

      const { data: feedback } = await supabase.from("feedback").select("rating").eq("volunteer_id", profile!.user_id);
      if (cancelled) return;
      setRatings((feedback ?? []).map((item) => Number(item.rating)));
      setState("ready");
    }

    void loadDashboard();
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
  const now = Date.now();
  const nextSession = sessions.filter((session) => new Date(session.scheduled_datetime).getTime() >= now)
    .sort((a, b) => a.scheduled_datetime.localeCompare(b.scheduled_datetime))[0];
  const todayKey = klDateKey(new Date(now).toISOString());
  const todaysSessions = sessions.filter((session) => klDateKey(session.scheduled_datetime) === todayKey)
    .filter((session) => session.session_id !== nextSession?.session_id)
    .sort((a, b) => a.scheduled_datetime.localeCompare(b.scheduled_datetime)).slice(0, 4);
  const requestById = new Map(requests.map((request) => [request.id, request]));

  if (state === "error") return <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
    <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700" role="alert">We couldn't load your volunteer dashboard data. Check that the volunteer dashboard migration has been applied, then try again.</p>
    <button className="mt-3 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2" type="button" onClick={() => setAttempt((value) => value + 1)}>Retry</button>
  </main>;

  return <main className="mx-auto w-full max-w-6xl space-y-7 px-4 py-6 sm:px-6 lg:px-8">
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Volunteer statistics">
      <Metric label="New requests" value={state === "loading" ? "—" : String(metrics.newRequests)} color="border-orange-200 bg-orange-50 text-orange-900" />
      <Metric label="Sessions this week" value={state === "loading" ? "—" : String(metrics.sessionsThisWeek)} color="border-blue-200 bg-blue-50 text-blue-900" />
      <Metric label="Average rating" value={state === "loading" ? "—" : metrics.averageRating} color="border-violet-200 bg-violet-50 text-violet-900" />
      <Metric label="Sessions completed" value={state === "loading" ? "—" : String(metrics.sessionsCompleted)} color="border-emerald-200 bg-emerald-50 text-emerald-900" />
    </section>

    <div className="grid gap-6 lg:grid-cols-2">
      <section aria-labelledby="new-requests-heading">
        <h2 id="new-requests-heading" className="mb-3 text-lg font-bold text-slate-900">New Requests</h2>
        {state === "loading" ? <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Loading your requests…</p> : newRequests.length ? <ul className="space-y-3">
          {newRequests.map((request) => <li key={request.id}>
            <DashboardCard
              title={request.title}
              dateTime={requestedDateTime(request)}
              person={request.requester_name}
              badge={<>
                <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">{request.category}</span>
                <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-800">Pending</span>
              </>}
            />
          </li>)}
        </ul> : <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No new requests right now.</p>}
      </section>

      <section aria-labelledby="today-sessions-heading">
        <h2 id="today-sessions-heading" className="mb-3 text-lg font-bold text-slate-900">Today&apos;s sessions</h2>
        {state === "loading" ? <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Loading your sessions…</p> : todaysSessions.length ? <ul className="space-y-3">
          {todaysSessions.map((session) => {
            const request = requestById.get(session.request_id);
            if (!request) return null;
            return <li key={session.session_id}>
              <DashboardCard
                title={request.title}
                dateTime={`${sessionDate.format(new Date(session.scheduled_datetime))} · ${formatRange(session.scheduled_datetime)} · ${session.support_mode ?? request.support_mode ?? "Support"}`}
                person={request.requester_name}
                badge={<span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">Scheduled</span>}
                action={<Link href={`/sessions/${session.session_id}`} className="text-sm font-semibold text-blue-700 underline-offset-4 hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">View details</Link>}
              />
            </li>;
          })}
        </ul> : <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No sessions scheduled for today.</p>}
      </section>
    </div>

    <section aria-labelledby="next-sessions-heading">
      <h2 id="next-sessions-heading" className="mb-3 text-lg font-bold text-slate-900">Next sessions</h2>
      {state === "loading" ? <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Loading your sessions…</p> : nextSession ? (() => {
        const request = requestById.get(nextSession.request_id);
        return <Link href={`/sessions/${nextSession.session_id}`} className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
          <DashboardCard
            title={request?.title ?? "Support session"}
            dateTime={`${sessionDate.format(new Date(nextSession.scheduled_datetime))} · ${formatRange(nextSession.scheduled_datetime)} · ${nextSession.support_mode ?? request?.support_mode ?? "Support"}`}
            person={request?.requester_name ?? "Student"}
            badge={<span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">Scheduled</span>}
            highlight
          />
        </Link>;
      })() : <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No upcoming sessions scheduled.</p>}
    </section>
  </main>;
}
