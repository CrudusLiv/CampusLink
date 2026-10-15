"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useCurrentUser } from "@/lib/useCurrentUser";

export type DashboardView = "student" | "volunteer";
type DashboardViewContextValue = { view: DashboardView; setView: (view: DashboardView) => void };

const DashboardViewContext = createContext<DashboardViewContextValue>({
  view: "student",
  setView: () => undefined,
});
export function VolunteerViewProvider({ children }: { children: ReactNode }) {
  const { profile } = useCurrentUser();
  const [view, setViewState] = useState<DashboardView>("student");

  useEffect(() => {
    if (!profile?.user_id) {
      setViewState("student");
      return;
    }
    // Dashboard view is a session preference. A newly loaded account always
    // starts in Student view, regardless of the previous login's selection.
    setViewState("student");
  }, [profile?.user_id]);

  const setView = useCallback((nextView: DashboardView) => {
    setViewState(nextView);
  }, []);

  const value = useMemo(() => ({ view, setView }), [view, setView]);
  return <DashboardViewContext.Provider value={value}>{children}</DashboardViewContext.Provider>;
}

export function useVolunteerDashboardView() {
  return useContext(DashboardViewContext);
}
