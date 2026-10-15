import type { Metadata } from "next";
import AppShell from "@/components/layout/AppShell";
import SupportRequestsTable from "./SupportRequestsTable";

export const metadata: Metadata = { title: "My Support Requests | CampusLink" };

export default function SupportRequestsPage() {
  return (
    <AppShell title="My Support Requests">
      <SupportRequestsTable />
    </AppShell>
  );
}
