"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import s from "./sessions.module.css";

type Notice = { notification_id: string; message: string };

/** Unread "session cancelled" notices for the signed-in user. The database only returns their own rows. */
export function CancellationNotices() {
  const [notices, setNotices] = useState<Notice[]>([]);

  useEffect(() => {
    let live = true;
    supabase
      .from("notification")
      .select("notification_id, message")
      .eq("type", "session_cancelled")
      .eq("read_status", false)
      .order("sent_at", { ascending: false })
      .then(({ data }) => live && setNotices(data ?? []));
    return () => { live = false; };
  }, []);

  async function dismiss(id: string) {
    const { error } = await supabase.from("notification").update({ read_status: true }).eq("notification_id", id);
    if (!error) setNotices((list) => list.filter((n) => n.notification_id !== id));
  }

  if (notices.length === 0) return null;
  return (
    <section className={s.notices} aria-label="Cancelled sessions">
      {notices.map((n) => (
        <p key={n.notification_id} className={s.notice} role="status">
          <span>{n.message}</span>
          <button type="button" className={s.noticeDismiss} onClick={() => void dismiss(n.notification_id)}>Dismiss</button>
        </p>
      ))}
    </section>
  );
}
