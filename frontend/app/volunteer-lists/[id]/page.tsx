import type { Metadata } from "next";
import AppShell from "@/components/layout/AppShell";
import VolunteerProfile from "./VolunteerProfile";

export const metadata: Metadata = { title: "Volunteer Profile | CampusLink" };

export default async function VolunteerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AppShell title="Volunteer Profile">
      <VolunteerProfile userId={id} />
    </AppShell>
  );
}
