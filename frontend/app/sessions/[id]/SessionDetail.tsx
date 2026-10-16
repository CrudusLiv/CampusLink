"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Avatar } from "@/components/sessions/Avatar";
import { fetchSession } from "@/lib/sessions/client";
import { supabase } from "@/lib/supabaseClient";
import { formatDate, formatTime } from "@/lib/sessions/time";
import type { SessionView } from "@/lib/sessions/types";
import styles from "./session-detail.module.css";

function toLocalDateTime(value: string) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export default function SessionDetail({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<SessionView | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReschedule, setShowReschedule] = useState(false);
  const [newDateTime, setNewDateTime] = useState("");
  const [rescheduleNote, setRescheduleNote] = useState("");
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetchSession(sessionId).then((record) => {
      if (active) {
        setSession(record);
        if (record) {
          void supabase.from("feedback").select("rating, comment").eq("session_id", record.id).maybeSingle().then(({ data }) => {
            if (!active || !data) return;
            setRating(Number(data.rating));
            setFeedback(data.comment ?? "");
          });
        }
        if (record) setNewDateTime(toLocalDateTime(record.scheduledDatetime));
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [sessionId]);

  function saveUpdate(update: Partial<SessionView>) {
    setError("");
    setSession((current) => current ? { ...current, ...update } : current);
    setMessage("This change is temporary and hasn't been saved yet.");
    return true;
  }

  async function submitRating(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const currentSession = session;
    if (!currentSession) {
      setError("We couldn't find this session.");
      return;
    }
    if (rating < 1) {
      setError("Choose a star rating before submitting.");
      return;
    }
    setError("");
    setMessage("");
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setError("Sign in before submitting session feedback.");
      return;
    }
    const { error: saveError } = await supabase.from("feedback").upsert({
      session_id: currentSession.id,
      volunteer_id: currentSession.volunteer.id,
      rating,
      comment: feedback.trim() || null,
    }, { onConflict: "session_id" });
    if (saveError) {
      setError("We couldn't save feedback for this session. Please try again.");
      return;
    }
    setMessage("Your feedback has been saved.");
  }

  function submitReschedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    const date = new Date(newDateTime);
    if (!newDateTime || Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
      setError("Choose a future date and time.");
      return;
    }
    if (saveUpdate({ scheduledDatetime: date.toISOString(), rescheduleNote: rescheduleNote.trim() })) {
      setShowReschedule(false);
    }
  }

  function finishSession(status: "Completed" | "Cancelled") {
    setMessage("");
    saveUpdate({ status });
  }

  if (loading) return <main className={styles.content}><p className={styles.message}>Loading session…</p></main>;
  if (!session) return (
    <main className={styles.content}>
      <p className={styles.message}>We couldn&apos;t find this session.</p>
      <Link className={styles.backLink} href="/sessions">← Back to My Support Sessions</Link>
    </main>
  );

  const iso = session.scheduledDatetime;
  const active = session.status === "Scheduled";

  return (
    <main className={styles.content}>
      <p className={styles.backRow}><Link className={styles.backLink} href="/sessions">← My Support Sessions</Link></p>
      <div className={styles.columns}>
        <section className={styles.sessionColumn} aria-label="Session details">
          <div className={styles.summary}>
            <Avatar person={session.other} />
            <div className={styles.summaryText}>
              <h2 className={styles.title}>{session.requestTitle}</h2>
              <p>{session.other.name} · {session.supportMode}</p>
              <p><time dateTime={iso}>{formatDate(iso)} · {formatTime(iso)}</time></p>
              {session.meetingLink && <a className={styles.meetingLink} href={session.meetingLink} target="_blank" rel="noopener noreferrer">Open meeting link</a>}
            </div>
            <span className={styles.status}>{session.status}</span>
          </div>

          {message && <p className={styles.success} role="status">{message}</p>}
          {error && <p className={styles.error} role="alert">{error}</p>}

          {active ? <>
            <div className={styles.actions}>
              <button className={styles.secondaryButton} type="button" onClick={() => { setShowReschedule((open) => !open); setMessage(""); setError(""); }}>
                {showReschedule ? "Close reschedule" : "Reschedule"}
              </button>
              <button className={styles.secondaryButton} type="button" onClick={() => finishSession("Cancelled")}>Cancel session</button>
            </div>

            {showReschedule && <form className={styles.rescheduleForm} onSubmit={submitReschedule}>
              <label className={styles.label} htmlFor="session-new-time">New date and time</label>
              <input id="session-new-time" className={styles.input} type="datetime-local" value={newDateTime} onChange={(event) => setNewDateTime(event.target.value)} required />
              <label className={styles.label} htmlFor="reschedule-note">Reschedule description (optional)</label>
              <textarea id="reschedule-note" className={styles.input} rows={3} value={rescheduleNote} onChange={(event) => setRescheduleNote(event.target.value)} placeholder="Add a note about the new time" />
              <button className={styles.primaryButton} type="submit">Save new time</button>
            </form>}

            <button className={styles.primaryButton} type="button" onClick={() => finishSession("Completed")}>Mark as completed</button>
          </> : <p className={styles.closedNotice}>This session is {session.status.toLowerCase()}.</p>}
        </section>

        <form className={styles.ratingPanel} onSubmit={submitRating}>
          <h2 className={styles.panelTitle}>Rate your session</h2>
          <fieldset className={styles.ratingFieldset}>
            <legend className={styles.srOnly}>Choose a star rating</legend>
            <div className={styles.stars}>
              {[1, 2, 3, 4, 5].map((star) => <button
                key={star}
                type="button"
                className={star <= rating ? styles.starSelected : styles.star}
                aria-label={`${star} star${star === 1 ? "" : "s"}`}
                aria-pressed={rating === star}
                onClick={() => { setRating(star); setMessage(""); setError(""); }}
              >★</button>)}
            </div>
          </fieldset>
          <label className={styles.srOnly} htmlFor="session-feedback">Comment</label>
          <textarea id="session-feedback" className={styles.comment} rows={5} value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Comment (optional)" maxLength={1000} />
          <button className={styles.primaryButton} type="submit">Submit feedback</button>
          <p className={styles.storageNote}>Your rating and comment are stored as session feedback.</p>
        </form>
      </div>
    </main>
  );
}
