"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { isDashboardViewReady, readDashboardView, saveDashboardView } from "@/lib/dashboard-view-storage";

export type DashboardView = "student" | "volunteer";
type DashboardViewContextValue = { view: DashboardView; setView: (view: DashboardView) => void; ready: boolean };

const DashboardViewContext = createContext<DashboardViewContextValue>({
  view: "student",
  setView: () => undefined,
  ready: false,
});
export function VolunteerViewProvider({ children }: { children: ReactNode }) {
  const { profile, loading } = useCurrentUser();
  const [view, setViewState] = useState<DashboardView>("student");
  const [resolvedForUser, setResolvedForUser] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (loading) return;
    if (!profile?.user_id) {
      setViewState("student");
      setResolvedForUser(null);
      return;
    }
    // Restore this account's selection when the app loads or the signed-in account changes.
    setViewState(readDashboardView(profile.user_id));
    setResolvedForUser(profile.user_id);
  }, [loading, profile?.user_id]);

  const setView = useCallback((nextView: DashboardView) => {
    setViewState(nextView);
    if (profile?.user_id) saveDashboardView(profile.user_id, nextView);
  }, [profile?.user_id]);

  const ready = isDashboardViewReady(loading, profile?.user_id ?? null, resolvedForUser);
  const value = useMemo(() => ({ view, setView, ready }), [view, setView, ready]);
  return <DashboardViewContext.Provider value={value}>{children}</DashboardViewContext.Provider>;
}

export function useVolunteerDashboardView() {
  return useContext(DashboardViewContext);
}
