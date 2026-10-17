"use client";

// Wrap any page with <AuthGuard> to make it logged-in only.
// Logged-out visitors are sent to /login.

import { useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AppShellLoading } from "@/components/layout/AppShell";
import { useCurrentUser } from "@/lib/useCurrentUser";

export default function AuthGuard({ children }: { children: ReactNode }) {
  const { profile, loading } = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !profile) {
      router.replace("/login");
    }
  }, [loading, profile, router]);

  // Still finding out who is logged in: keep the page layout on screen (sidebar, header) with placeholders in
  // the content area, so the page doesn't flash a bare "Loading..." and then jump to the real layout.
  // Nothing private is shown, only the fixed menu labels.
  if (loading) return <AppShellLoading />;

  // Not logged in: the effect above is sending them to /login.
  if (!profile) {
    return (
      <p style={{ padding: "2rem", fontFamily: "system-ui, sans-serif", color: "#4b5563" }}>
        Redirecting to sign in...
      </p>
    );
  }

  return <>{children}</>;
}
