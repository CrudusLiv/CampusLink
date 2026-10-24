import type { Metadata } from "next";
import AppShell from "@/components/layout/AppShell";
import SupportRequestsTable from "./SupportRequestsTable";

export const metadata: Metadata = { title: "My Support Requests | CampusLink" };

export default async function SupportRequestsPage({ searchParams }: { searchParams: Promise<{ submitted?: string }> }) {
  const { submitted } = await searchParams;
  return (
    <AppShell title="My Support Requests">
      <SupportRequestsTable showSubmittedToast={submitted === "1"} />
    </AppShell>
  );
}
