"use client";

// Hook that tells any page who is logged in.
// Returns the user's row from public.users (name, role, etc.), or null if logged out.
// Usage:  const { profile, loading } = useCurrentUser();

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export type UserProfile = {
  user_id: string;
  email: string;
  name: string;
  student_id: string;
  contact_no: string | null;
  photo_url: string | null;
  role: "student" | "admin";
  faculty: string | null;
  bio: string | null;
};

export function useCurrentUser() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile(userId: string | undefined) {
      if (!userId) {
        setProfile(null);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("users")
        .select("*")
        .eq("user_id", userId)
        .single();
      setProfile(data as UserProfile | null);
      setLoading(false);
    }

    // Check once when the page opens
    supabase.auth.getSession().then(({ data }) => {
      loadProfile(data.session?.user.id);
    });

    // Update again whenever the user logs in or out
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      loadProfile(session?.user.id);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return { profile, loading };
}
