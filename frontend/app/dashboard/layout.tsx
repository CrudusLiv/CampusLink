// Every page inside this folder now requires login.
import { ReactNode } from "react";
import AuthGuard from "@/components/auth/AuthGuard";

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
