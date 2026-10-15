import type { ReactNode } from "react";
import AuthGuard from "@/components/auth/AuthGuard";

export default function SupportHistoryLayout({ children }: { children: ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
