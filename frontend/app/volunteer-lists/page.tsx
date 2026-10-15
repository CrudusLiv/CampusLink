import type { Metadata } from "next";
import AppShell from "@/components/layout/AppShell";
import VolunteerDirectory from "./VolunteerDirectory";

export const metadata: Metadata = { title: "Volunteer Lists | CampusLink" };

export default function VolunteerListsPage() {
  return (
    <AppShell title="Volunteer Lists">
      <VolunteerDirectory />
    </AppShell>
  );
}
