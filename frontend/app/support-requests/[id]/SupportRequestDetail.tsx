"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SubmitRequestForm } from "@/app/sessions/SubmitRequestForm";
import type { ExistingSupportRequest } from "@/app/sessions/SubmitRequestForm";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/lib/useCurrentUser";
import styles from "../support-requests.module.css";

export default function SupportRequestDetail({ requestId, mode }: { requestId: string; mode: "view" | "edit" }) {
  const { profile } = useCurrentUser();
  const [request, setRequest] = useState<ExistingSupportRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    async function loadRequest() {
      const { data, error: queryError } = await supabase
        .from("support_request")
        .select("request_id, title, description, category, requested_date, requested_time, support_mode, volunteer_id, status")
        .eq("request_id", requestId)
        .eq("requester_id", profile!.user_id)
        .maybeSingle();

      if (cancelled) return;
      if (queryError || !data) {
        setError("We couldn't find this support request.");
        setLoading(false);
        return;
      }
      if (mode === "edit" && data.status !== "Pending") {
        setError("Only pending requests can be edited.");
        setLoading(false);
        return;
      }

      const { data: volunteer, error: volunteerError } = data.volunteer_id
        ? await supabase.from("users").select("name").eq("user_id", data.volunteer_id).maybeSingle()
        : { data: null, error: null };
      if (cancelled) return;
      if (volunteerError) {
        setError("We couldn't load the selected volunteer.");
        setLoading(false);
        return;
      }

      setRequest({
        id: data.request_id,
        title: data.title,
        description: data.description,
        category: data.category,
        requested_date: data.requested_date,
        requested_time: data.requested_time,
        support_mode: data.support_mode,
        volunteer_id: data.volunteer_id,
        volunteer_name: volunteer?.name ?? null,
      });
      setLoading(false);
    }

    loadRequest();
    return () => { cancelled = true; };
  }, [profile, requestId, mode]);

  if (loading) return <main className={styles.content}><p className={styles.message}>Loading request…</p></main>;
  if (error || !request) return (
    <main className={styles.content}>
      <p className={styles.error} role="alert">{error || "We couldn't find this support request."}</p>
      <Link className={styles.actionButton} href="/support-requests">Back to My Support Requests</Link>
    </main>
  );

  return <main className={styles.content}><SubmitRequestForm mode={mode} request={request} /></main>;
}
