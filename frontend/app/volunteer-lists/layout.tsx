import type { ReactNode } from "react";
import AuthGuard from "@/components/auth/AuthGuard";

export default function VolunteerListsLayout({ children }: { children: ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
