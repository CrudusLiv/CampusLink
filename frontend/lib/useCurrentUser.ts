"use client";

// Tells any page who is logged in.
// Returns the user's row from public.users (name, role, etc.), or null if logged out.
// Usage:  const { profile, loading } = useCurrentUser();
//
// The profile lives in ONE shared store, not in each component. Before, every component that called this
// hook started at "loading" and fetched the profile again, so each move to another section briefly replaced
// the whole page (sidebar included) with "Loading...". Now it is fetched once and every page reads the same
// value, so moving around the app no longer flashes.

import { useSyncExternalStore } from "react";
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

type State = { profile: UserProfile | null; loading: boolean };

const LOADING: State = { profile: null, loading: true };
let state: State = LOADING;
const listeners = new Set<() => void>();
let started = false;
let latest = 0; // each load gets a number so a slow, older answer can never overwrite a newer one
let inFlightFor: string | undefined;

function publish(next: State) {
  state = next;
  listeners.forEach((listener) => listener());
}

async function load(userId: string | undefined, force = false) {
  if (!userId) {
    latest++;
    inFlightFor = undefined;
    publish({ profile: null, loading: false });
    return;
  }

  // Same person we already have (token refreshes, repeated auth events): nothing to do.
  if (!force && state.profile?.user_id === userId) {
    if (state.loading) publish({ profile: state.profile, loading: false });
    return;
  }
  if (!force && inFlightFor === userId) return;

  // A different person signed in: never show the previous person's details while the new ones load.
  if (state.profile && state.profile.user_id !== userId) publish(LOADING);

  const mine = ++latest;
  inFlightFor = userId;
  const { data } = await supabase.from("users").select("*").eq("user_id", userId).single();
  if (mine !== latest) return;
  inFlightFor = undefined;
  publish({ profile: (data as UserProfile | null) ?? null, loading: false });
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  supabase.auth.getSession().then(({ data }) => load(data.session?.user.id));
  // Also fires on login, logout and token refresh.
  supabase.auth.onAuthStateChange((_event, session) => {
    load(session?.user.id);
  });
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Call after changing the signed-in user's own row (for example saving the profile) so every page updates. */
export async function refreshCurrentUser() {
  const { data } = await supabase.auth.getSession();
  await load(data.session?.user.id, true);
}

export function useCurrentUser() {
  // The server render has no login, so it matches the first client render and nothing mismatches.
  return useSyncExternalStore(subscribe, () => state, () => LOADING);
}
