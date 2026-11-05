import type { Metadata } from "next";
import AppShell from "@/components/layout/AppShell";
import SessionDetail from "./SessionDetail";

export const metadata: Metadata = { title: "Support Session | CampusLink" };

export default async function SessionDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string }> }) {
  const { id } = await params;
  const { from } = await searchParams;
  // Accept only known history origins; any other value falls back to My Support Sessions.
  return (
    <AppShell title="Support Session">
      <SessionDetail sessionId={id} backTo={from === "volunteer-history" ? "volunteer-history" : from === "history" ? "history" : "sessions"} />
    </AppShell>
  );
}
