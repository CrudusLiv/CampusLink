"use client";

// Shared shell for signed-in pages: sidebar (desktop), header, bottom tab bar (mobile).
// Role comes from the signed-in user's row in public.users (no manual toggle).
// Items without an href are pages that don't exist yet: shown greyed out, not clickable.
// On desktop the sidebar can be collapsed to an icon rail; the choice is remembered in this browser.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import LogoutButton from "@/components/auth/LogoutButton";
import { useVolunteerDashboardView } from "@/components/dashboard/VolunteerViewContext";
import { useCurrentUser } from "@/lib/useCurrentUser";
import NotificationBell from "@/components/layout/NotificationBell";
import styles from "./AppShell.module.css";
import { spaceGrotesk } from "@/lib/fonts";

// Same wordmark font as the landing page
const display = spaceGrotesk;

type Item = { label: string; href?: string };

// Simple line icons for the collapsed sidebar (one path per page)
const ICONS: Record<string, string> = {
  "Dashboard": "M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10",
  "Overview": "M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10",
  "Ask for Support": "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z",
  "Volunteer List": "M16 19v-1a4 4 0 0 0-8 0v1M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 19v-1a3 3 0 0 0-2-2.8M4 19v-1a3 3 0 0 1 2-2.8",
  "My Support Requests": "M9 5h6M9 12h6M9 16h4M6 3h12v18H6z",
  "Incoming Requests": "M4 13h4l2 3h4l2-3h4M4 13l2-8h12l2 8v6H4z",
  "My Support Sessions": "M3 5h18v16H3zM3 10h18M8 3v4M16 3v4",
  "My Sessions": "M3 5h18v16H3zM3 10h18M8 3v4M16 3v4",
  "Skills & Availability": "M12 3l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8-4.3-4.1 5.9-.8z",
  "My History": "M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2",
  "My Profile": "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  "User Registrations": "M15 19v-1a4 4 0 0 0-8 0v1M11 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 8v6M16 11h6",
};

function NavIcon({ label }: { label: string }) {
  return (
    <svg className={styles.navIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[label] ?? "M12 12h.01"} />
    </svg>
  );
}

const COLLAPSE_KEY = "campuslink-sidebar-collapsed";

const STUDENT_NAV: Item[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Ask for Support", href: "/sessions/ask-for-support" },
  { label: "Volunteer List", href: "/volunteer-lists" },
  { label: "My Support Requests", href: "/support-requests" },
  { label: "My Support Sessions", href: "/sessions" },
  { label: "My History", href: "/support-history" },
  { label: "My Profile", href: "/profile" },
];
const ADMIN_NAV: Item[] = [{ label: "Overview", href: "/dashboard" }, { label: "User Registrations" }];
const VOLUNTEER_NAV: Item[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Incoming Requests", href: "/volunteer/requests" },
  { label: "My Sessions", href: "/sessions" },
  { label: "Skills & Availability", href: "/volunteer/setup" },
  { label: "My History", href: "/volunteer/history" },
  { label: "My Profile", href: "/profile" },
];
const STUDENT_TABS: Item[] = [
  { label: "Home", href: "/dashboard" },
  { label: "Ask", href: "/sessions/ask-for-support" },
  { label: "Requests", href: "/support-requests" },
  { label: "Sessions", href: "/sessions" },
  { label: "Profile", href: "/profile" },
];
const ADMIN_TABS: Item[] = [{ label: "Overview", href: "/dashboard" }, { label: "Registrations" }];
const VOLUNTEER_TABS: Item[] = [
  { label: "Home", href: "/dashboard" },
  { label: "Requests", href: "/volunteer/requests" },
  { label: "Sessions", href: "/sessions" },
  { label: "Profile", href: "/profile" },
];

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");

export default function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const { profile } = useCurrentUser();
  const { view, ready: viewReady } = useVolunteerDashboardView();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Remember the sidebar choice in this browser (storage can be blocked, so ignore errors)
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {}
  }, []);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  }
  const admin = profile?.role === "admin";
  const volunteer = !admin && view === "volunteer";
  const mode = admin ? "admin" : volunteer ? "volunteer" : "student";
  const modeLabel = admin ? "Admin" : volunteer ? "Volunteer" : "Student";
  const navItems = admin ? ADMIN_NAV : volunteer ? VOLUNTEER_NAV : STUDENT_NAV;
  const tabItems = admin ? ADMIN_TABS : volunteer ? VOLUNTEER_TABS : STUDENT_TABS;
  const isActive = (href?: string) =>
    !!href &&
    (pathname === href ||
      (pathname.startsWith(href + "/") && pathname !== "/sessions/ask-for-support"));

  function renderItem(item: Item, base: string, activeClass: string) {
    if (!item.href) {
      return (
        <span key={item.label} className={`${base} ${styles.soon}`} aria-disabled="true" title="Coming soon">
          {base === styles.navItem && <NavIcon label={item.label} />}
          <span className={styles.navLabel}>{item.label}</span>
        </span>
      );
    }
    const active = isActive(item.href);
    return (
      <Link
        key={item.label}
        href={item.href}
        className={`${base} ${active ? activeClass : ""}`}
        aria-current={active ? "page" : undefined}
        title={collapsed ? item.label : undefined}
      >
        {base === styles.navItem && <NavIcon label={item.label} />}
        <span className={styles.navLabel}>{item.label}</span>
      </Link>
    );
  }

  return (
    <div className={`${styles.layout} ${display.variable}`} data-collapsed={collapsed ? "true" : undefined} data-mode={viewReady ? mode : "loading"}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          <Link href="/dashboard" className={styles.brand} aria-label="CampusLink home">
            <span className={styles.brandName}>CampusLink</span>
            <span className={styles.brandShort} aria-hidden="true">CL</span>
          </Link>
          <button
            type="button"
            className={styles.collapseButton}
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={collapsed ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6"} />
            </svg>
          </button>
        </div>
        {viewReady && <div className={`${styles.modePill} ${styles.section}`}>{modeLabel}</div>}
        {viewReady && <nav className={styles.nav} aria-label="Main">
          {navItems.map((i) => renderItem(i, styles.navItem, styles.navItemActive))}
        </nav>}
        <LogoutButton className={styles.logout} />
      </aside>

      <div className={styles.main}>
        <div className={styles.modeStrip} aria-hidden="true" />
        <header className={styles.header}>
          <h1 className={styles.title}>{title}</h1>
          <div className={styles.user}>
            {viewReady && <span className={styles.modePill}>{modeLabel}</span>}
            <NotificationBell userId={profile?.user_id} />
            {profile && <span className={styles.userName}>{profile.name}</span>}
            <LogoutButton className={styles.mobileLogout} />
            <div className={styles.avatar} role="img" aria-label={profile ? `${profile.name}'s avatar` : "Your avatar"}>
              {profile ? initials(profile.name) : ""}
            </div>
          </div>
        </header>

        <div className={styles.body}>{children}</div>
      </div>

      {viewReady && <nav className={styles.tabs} aria-label="Main">
        {tabItems.map((i) => renderItem(i, styles.tab, styles.tabActive))}
      </nav>}
    </div>
  );
}

/**
 * The shell with placeholder content. Show this while a page is still loading, instead of nothing or a bare
 * "Loading..." line, so the sidebar and header stay on screen and only the content area fills in.
 */
export function AppShellLoading({ title = "" }: { title?: string }) {
  return (
    <AppShell title={title}>
      <div className={styles.loadingBody} role="status" aria-live="polite">
        <span className={styles.srOnly}>Loading…</span>
        <div className={styles.loadingBar} aria-hidden="true" />
        <div className={styles.loadingBar} aria-hidden="true" />
        <div className={styles.loadingBar} aria-hidden="true" />
      </div>
    </AppShell>
  );
}
