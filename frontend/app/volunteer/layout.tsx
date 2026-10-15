// Every page inside /volunteer requires login.
import { ReactNode } from "react";
import AuthGuard from "@/components/auth/AuthGuard";

export default function VolunteerLayout({ children }: { children: ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
