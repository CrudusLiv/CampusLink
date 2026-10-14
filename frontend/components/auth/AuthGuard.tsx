"use client";

// Wrap any page with <AuthGuard> to make it logged-in only.
// Logged-out visitors are sent to /login.

import { useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/lib/useCurrentUser";

export default function AuthGuard({ children }: { children: ReactNode }) {
  const { profile, loading } = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !profile) {
      router.replace("/login");
    }
  }, [loading, profile, router]);

  // Show nothing private until we know the user is logged in
  if (loading || !profile) {
    return (
      <p style={{ padding: "2rem", fontFamily: "system-ui, sans-serif", color: "#4b5563" }}>
        Loading...
      </p>
    );
  }

  return <>{children}</>;
}
