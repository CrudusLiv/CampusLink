"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Avatar } from "@/components/sessions/Avatar";
import { cancelSession, completeSession, fetchSession, sendFeedback } from "@/lib/sessions/client";
import { formatDate, formatRange } from "@/lib/sessions/time";
import type { SessionView } from "@/lib/sessions/types";
import styles from "./session-detail.module.css";

const Stars = ({ value }: { value: number }) => (
  <span className={styles.starsStatic} role="img" aria-label={`${value} out of 5 stars`}>{"★".repeat(value)}{"☆".repeat(5 - value)}</span>
);

export default function SessionDetail({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<SessionView | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [now, setNow] = useState(0);

  useEffect(() => {
    let live = true;
    fetchSession(sessionId)
      .then((record) => live && (setSession(record), setLoadFailed(false)))
      .catch(() => live && setLoadFailed(true))
      .finally(() => live && (setNow(Date.now()), setLoading(false)));
    return () => { live = false; };
  }, [sessionId]);

  /** Run an action, show the result, and reload so the page always shows what is really saved. */
  async function run(action: () => Promise<{ ok: true } | { ok: false; message: string }>, done: string) {
    setBusy(true);
    setMessage("");
    setError("");
    const result = await action().catch(() => ({ ok: false as const, message: "Something went wrong. Please try again." }));
    if (result.ok) {
      const fresh = await fetchSession(sessionId).catch(() => null);
      if (fresh) { setSession(fresh); setNow(Date.now()); }
      setMessage(done);
      setConfirmCancel(false);
    } else {
      setError(result.message);
    }
    setBusy(false);
  }

  function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (rating < 1) {
      setMessage("");
      setError("Choose a star rating before submitting.");
      return;
    }
    void run(() => sendFeedback(sessionId, rating, comment), "Thank you! Your feedback has been saved.");
  }

  if (loading) return <main className={styles.content}><p className={styles.message}>Loading session…</p></main>;
  if (loadFailed || !session) return (
    <main className={styles.content}>
      <p className={styles.message}>{loadFailed ? "We could not load this session. Please try again." : "We could not find this session."}</p>
      <Link className={styles.backLink} href="/sessions">← Back to My Support Sessions</Link>
    </main>
  );

  const iso = session.scheduledDatetime;
  const isVolunteer = session.other.id === session.requester.id;
  const started = new Date(iso).getTime() <= now;
  const tooLateToCancel = new Date(iso).getTime() - now < 24 * 60 * 60 * 1000;
  const hasFeedback = session.rating !== undefined;

  return (
    <main className={styles.content}>
      <p className={styles.backRow}><Link className={styles.backLink} href="/sessions">← My Support Sessions</Link></p>

      <section className={styles.card} aria-label="Session details">
        <div className={styles.summary}>
          <Avatar person={session.other} />
          <div className={styles.summaryText}>
            <h2 className={styles.title}>{session.requestTitle}</h2>
            <p>With {session.other.name}</p>
          </div>
          <span className={`${styles.status} ${styles[`status${session.status}`]}`}>{session.status}</span>
        </div>
        <dl className={styles.facts}>
          <div><dt>When</dt><dd><time dateTime={iso}>{formatDate(iso)}, {formatRange(iso)}</time> (1 hour)</dd></div>
          <div><dt>How</dt><dd>{session.supportMode}</dd></div>
          {session.requestDescription && <div><dt>Request</dt><dd className={styles.description}>{session.requestDescription}</dd></div>}
          {session.meetingLink && <div><dt>Link</dt><dd><a className={styles.meetingLink} href={session.meetingLink} target="_blank" rel="noopener noreferrer">Open meeting link</a></dd></div>}
        </dl>

        {message && <p className={styles.success} role="status">{message}</p>}
        {error && <p className={styles.error} role="alert">{error}</p>}

        {session.status === "Scheduled" && (
          <div className={styles.actions}>
            {isVolunteer && (
              <div className={styles.action}>
                <button className={styles.primaryButton} type="button" disabled={busy || !started} onClick={() => void run(() => completeSession(sessionId), "Session marked as completed.")}>
                  Mark as completed
                </button>
                {!started && <p className={styles.hint}>You can mark this session as completed once it has started ({formatDate(iso)}, {formatRange(iso)}).</p>}
              </div>
            )}
            {confirmCancel ? (
              <div className={styles.confirmBox} role="alertdialog" aria-labelledby="cancel-q">
                <p id="cancel-q" className={styles.confirmText}>Cancel this session? This cannot be undone.</p>
                <button className={styles.dangerButton} type="button" disabled={busy} onClick={() => void run(() => cancelSession(sessionId), "Session cancelled.")}>Yes, cancel session</button>
                <button className={styles.secondaryButton} type="button" disabled={busy} onClick={() => setConfirmCancel(false)}>Keep session</button>
              </div>
            ) : (
              <div className={styles.action}>
                <button className={styles.secondaryButton} type="button" disabled={busy || tooLateToCancel} onClick={() => { setConfirmCancel(true); setMessage(""); setError(""); }}>Cancel session</button>
                {tooLateToCancel && <p className={styles.hint}>Sessions can only be cancelled at least 24 hours before they start.</p>}
              </div>
            )}
          </div>
        )}
        {session.status === "Cancelled" && <p className={styles.closedNotice}>This session was cancelled.</p>}
      </section>

      {session.status === "Completed" && (
        <section className={styles.card} aria-labelledby="feedback-title">
          <h2 id="feedback-title" className={styles.panelTitle}>Feedback</h2>
          {hasFeedback ? (
            <>
              <Stars value={session.rating!} />
              <p className={styles.comment}>{session.feedback || "No comment left."}</p>
            </>
          ) : isVolunteer ? (
            <p className={styles.hint}>{session.other.name} has not left feedback yet.</p>
          ) : (
            <form className={styles.feedbackForm} onSubmit={submitFeedback}>
              <fieldset className={styles.ratingFieldset}>
                <legend className={styles.label}>How was your session?</legend>
                <div className={styles.stars}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className={star <= rating ? styles.starSelected : styles.star}
                      aria-label={`${star} star${star === 1 ? "" : "s"}`}
                      aria-pressed={rating === star}
                      onClick={() => { setRating(star); setError(""); }}
                    >★</button>
                  ))}
                </div>
              </fieldset>
              <label className={styles.label} htmlFor="session-feedback">Comment (optional)</label>
              <textarea id="session-feedback" className={styles.input} rows={4} value={comment} onChange={(event) => setComment(event.target.value)} maxLength={1000} />
              <button className={styles.primaryButton} type="submit" disabled={busy}>Submit feedback</button>
              <p className={styles.hint}>You can only submit feedback once, and it cannot be changed afterwards.</p>
            </form>
          )}
        </section>
      )}
    </main>
  );
}
