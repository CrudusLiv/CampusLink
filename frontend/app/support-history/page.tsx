import type { Metadata } from "next";
import AppShell from "@/components/layout/AppShell";
import SupportHistoryTable from "./SupportHistoryTable";

export const metadata: Metadata = { title: "My History | CampusLink" };

export default function SupportHistoryPage() {
  return (
    <AppShell title="My History">
      <SupportHistoryTable />
    </AppShell>
  );
}
