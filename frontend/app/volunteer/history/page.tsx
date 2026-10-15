import type { Metadata } from "next";
import AppShell from "@/components/layout/AppShell";
import VolunteerRequestList from "@/components/dashboard/VolunteerRequestList";

export const metadata: Metadata = { title: "My History | CampusLink" };
export default function VolunteerHistoryPage() {
  return <AppShell title="My History"><VolunteerRequestList view="history" /></AppShell>;
}
