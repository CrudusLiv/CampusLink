import type { Metadata } from "next";
import AppShell from "@/components/layout/AppShell";
import SessionDetail from "./SessionDetail";

export const metadata: Metadata = { title: "Support Session | CampusLink" };

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AppShell title="Support Session">
      <SessionDetail sessionId={id} />
    </AppShell>
  );
}
