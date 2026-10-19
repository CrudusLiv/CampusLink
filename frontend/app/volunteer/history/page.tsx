import type { Metadata } from "next";
import AppShell from "@/components/layout/AppShell";
import VolunteerHistoryTable from "./VolunteerHistoryTable";

export const metadata: Metadata = { title: "My History | CampusLink" };
export default function VolunteerHistoryPage() {
  return <AppShell title="My History"><VolunteerHistoryTable /></AppShell>;
}
