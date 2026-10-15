import type { ReactNode } from "react";
import AuthGuard from "@/components/auth/AuthGuard";

export default function SupportRequestsLayout({ children }: { children: ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
