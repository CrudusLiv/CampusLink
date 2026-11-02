export type DashboardViewPreference = "student" | "volunteer";

type SessionStore = Pick<Storage, "getItem" | "setItem">;
const KEY_PREFIX = "campuslink:dashboard-view:";

export function isDashboardViewReady(
  loading: boolean,
  userId: string | null,
  resolvedForUser: string | null | undefined,
): boolean {
  return !loading && (userId === null ? resolvedForUser === null : resolvedForUser === userId);
}

export function readDashboardView(userId: string, store?: SessionStore): DashboardViewPreference {
  try {
    const value = (store ?? window.sessionStorage).getItem(`${KEY_PREFIX}${userId}`);
    return value === "volunteer" ? "volunteer" : "student";
  } catch {
    return "student";
  }
}

export function saveDashboardView(userId: string, view: DashboardViewPreference, store?: SessionStore): void {
  try {
    (store ?? window.sessionStorage).setItem(`${KEY_PREFIX}${userId}`, view);
  } catch {
    // Keep the in-memory switch working when browser storage is unavailable.
  }
}
