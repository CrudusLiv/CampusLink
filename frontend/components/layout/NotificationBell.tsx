"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { notificationTone } from "@/lib/notifications/display";
import styles from "./NotificationBell.module.css";

type Notice = { notification_id: string; type: string; message: string; sent_at: string };

export default function NotificationBell({ userId }: { userId?: string }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [panelNotices, setPanelNotices] = useState<Notice[]>([]);
  const [open, setOpen] = useState(false);
  const [toasts, setToasts] = useState<Notice[]>([]);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.notification_id !== id));
  }, []);

  const loadUnread = useCallback(async () => {
    if (!userId) { setNotices([]); return; }
    const { data } = await supabase.from("notification")
      .select("notification_id, type, message, sent_at")
      .eq("read_status", false).order("sent_at", { ascending: false });
    setNotices((data ?? []) as Notice[]);
  }, [userId]);

  useEffect(() => {
    if (!userId) { setNotices([]); return; }
    let alive = true;
    void supabase.from("notification")
      .select("notification_id, type, message, sent_at")
      .eq("read_status", false).order("sent_at", { ascending: false })
      .then(({ data }) => { if (alive) setNotices((data ?? []) as Notice[]); });
    const channel = supabase.channel(`notifications:${userId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "notification", filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const notice = payload.new as Notice;
        setNotices((current) => current.some((item) => item.notification_id === notice.notification_id)
          ? current : [notice, ...current]);
        setPanelNotices((current) => current.some((item) => item.notification_id === notice.notification_id)
          ? current : [notice, ...current]);
        setToasts((current) => current.some((item) => item.notification_id === notice.notification_id)
          ? current : [...current, notice]);
      }).subscribe((status) => {
        // Reconcile after subscribing to cover rows inserted between the first query and channel setup.
        if (status === "SUBSCRIBED") void loadUnread();
      });
    return () => { alive = false; void supabase.removeChannel(channel); };
  }, [userId]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); setPanelNotices([]); triggerRef.current?.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  async function toggle() {
    if (open) { setOpen(false); setPanelNotices([]); return; }
    setPanelNotices(notices);
    setOpen(true);
    const displayed = notices;
    if (displayed.length) {
      const ids = displayed.map((item) => item.notification_id);
      const { error } = await supabase.from("notification").update({ read_status: true }).in("notification_id", ids);
      if (!error) setNotices((current) => current.filter((item) => !ids.includes(item.notification_id)));
      else void loadUnread();
    }
  }

  return (
    <div className={styles.wrap}>
      <button ref={triggerRef} type="button" className={styles.bell} onClick={() => void toggle()}
        aria-label={`Notifications${notices.length ? `, ${notices.length} unread` : ""}`}
        aria-haspopup="dialog" aria-expanded={open}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
        {notices.length > 0 && <span className={styles.count} aria-label={`${notices.length} unread notifications`}>{notices.length > 99 ? "99+" : notices.length}</span>}
      </button>
      {open && <section className={styles.popover} role="dialog" aria-label="Notifications" aria-modal="false">
        <div className={styles.popoverHead}><h2>Notifications</h2><button ref={closeRef} type="button" onClick={() => { setOpen(false); setPanelNotices([]); triggerRef.current?.focus(); }} aria-label="Close notifications">×</button></div>
        {panelNotices.length === 0 ? <p className={styles.empty}>You&apos;re all caught up.</p> : <ul className={styles.list}>
          {panelNotices.map((notice) => <li key={notice.notification_id} className={styles[notificationTone(notice.type)]}><p>{notice.message}</p><time dateTime={notice.sent_at}>{new Date(notice.sent_at).toLocaleString()}</time></li>)}
        </ul>}
      </section>}
      {toasts.length > 0 && <div className={styles.toastStack} aria-label="New notifications">
        {toasts.map((notice) => <ToastMessage key={notice.notification_id} notice={notice} onDismiss={dismissToast} />)}
      </div>}
    </div>
  );
}

function ToastMessage({ notice, onDismiss }: { notice: Notice; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(notice.notification_id), 2000);
    return () => window.clearTimeout(timer);
  }, [notice.notification_id, onDismiss]);

  return (
    <div className={`${styles.toast} ${styles[`toast${notificationTone(notice.type) === "success" ? "Success" : "Error"}`]}`} role="status" aria-live="polite">
      <span>{notice.message}</span>
    </div>
  );
}
