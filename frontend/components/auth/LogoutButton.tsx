"use client";

// Logs the user out of Supabase and sends them back to the login page.

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <button type="button" onClick={handleLogout} className={className}>
      Log out
    </button>
  );
}
