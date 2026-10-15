import type { Metadata } from "next";
import AppShell from "@/components/layout/AppShell";
import VolunteerRequestList from "@/components/dashboard/VolunteerRequestList";

export const metadata: Metadata = { title: "Incoming Requests | CampusLink" };
export default function IncomingRequestsPage() {
  return <AppShell title="Incoming Requests"><VolunteerRequestList view="incoming" /></AppShell>;
}
