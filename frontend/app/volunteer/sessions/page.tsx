import type { Metadata } from "next";
import AppShell from "@/components/layout/AppShell";
import VolunteerRequestList from "@/components/dashboard/VolunteerRequestList";

export const metadata: Metadata = { title: "My Sessions | CampusLink" };
export default function VolunteerSessionsPage() {
  return <AppShell title="My Sessions"><VolunteerRequestList view="sessions" /></AppShell>;
}
