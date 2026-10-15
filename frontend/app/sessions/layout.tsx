// Every page inside this folder requires login (same pattern as app/dashboard/layout.tsx).
import { ReactNode } from "react";
import AuthGuard from "@/components/auth/AuthGuard";

export default function SessionsLayout({ children }: { children: ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
