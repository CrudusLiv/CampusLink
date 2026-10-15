import type { Metadata } from "next";
import AppShell from "@/components/layout/AppShell";
import SupportRequestDetail from "./SupportRequestDetail";

export const metadata: Metadata = { title: "Support Request | CampusLink" };

export default async function SupportRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const mode = query.mode === "edit" ? "edit" : "view";
  return (
    <AppShell title={mode === "view" ? "View Support Request" : "Edit Support Request"}>
      <SupportRequestDetail requestId={id} mode={mode} />
    </AppShell>
  );
}
