"use client";

// Shared shell for signed-in pages: sidebar (desktop), header, bottom tab bar (mobile).
// Role comes from the signed-in user's row in public.users (no manual toggle).
// Items without an href are pages that don't exist yet: shown greyed out, not clickable.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import LogoutButton from "@/components/auth/LogoutButton";
import { useVolunteerDashboardView } from "@/components/dashboard/VolunteerViewContext";
import { useCurrentUser } from "@/lib/useCurrentUser";
import styles from "./AppShell.module.css";

type Item = { label: string; href?: string };

const STUDENT_NAV: Item[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Ask for Support", href: "/sessions/ask-for-support" },
  { label: "Volunteer List", href: "/volunteer-lists" },
  { label: "My Support Requests", href: "/support-requests" },
  { label: "My Support Sessions", href: "/sessions" },
  { label: "Support History", href: "/support-history" },
  { label: "My Profile", href: "/profile" },
];
const ADMIN_NAV: Item[] = [{ label: "Overview", href: "/dashboard" }, { label: "User Registrations" }];
const VOLUNTEER_NAV: Item[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Incoming Requests", href: "/volunteer/requests" },
  { label: "My Sessions", href: "/volunteer/sessions" },
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
  { label: "Sessions", href: "/volunteer/sessions" },
  { label: "Profile", href: "/profile" },
];

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");

export default function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const { profile } = useCurrentUser();
  const { view } = useVolunteerDashboardView();
  const pathname = usePathname();
  const admin = profile?.role === "admin";
  const volunteer = !admin && view === "volunteer";
  const navItems = admin ? ADMIN_NAV : volunteer ? VOLUNTEER_NAV : STUDENT_NAV;
  const tabItems = admin ? ADMIN_TABS : volunteer ? VOLUNTEER_TABS : STUDENT_TABS;
  const isActive = (href?: string) =>
    !!href &&
    (pathname === href ||
      (href === "/sessions" && pathname === "/sessions/schedule") ||
      (pathname.startsWith(href + "/") && pathname !== "/sessions/ask-for-support"));

  function renderItem(item: Item, base: string, activeClass: string) {
    if (!item.href) {
      return (
        <span key={item.label} className={`${base} ${styles.soon}`} aria-disabled="true" title="Coming soon">
          {item.label}
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
      >
        {item.label}
      </Link>
    );
  }

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <Link href="/dashboard" className={styles.logo}>
          <span className={styles.logoIcon} aria-hidden="true" />
          CampusLink
        </Link>
        <div className={styles.section}>{admin ? "Admin" : volunteer ? "Volunteer" : "Student"}</div>
        <nav className={styles.nav} aria-label="Main">
          {navItems.map((i) => renderItem(i, styles.navItem, styles.navItemActive))}
        </nav>
        <LogoutButton className={styles.logout} />
      </aside>

      <div className={styles.main}>
        <header className={styles.header}>
          <h1 className={styles.title}>{title}</h1>
          <div className={styles.user}>
            {profile && <span className={styles.userName}>{profile.name}</span>}
            <LogoutButton className={styles.mobileLogout} />
            <div className={styles.avatar} role="img" aria-label={profile ? `${profile.name}'s avatar` : "Your avatar"}>
              {profile ? initials(profile.name) : ""}
            </div>
          </div>
        </header>

        <div className={styles.body}>{children}</div>
      </div>

      <nav className={styles.tabs} aria-label="Main">
        {tabItems.map((i) => renderItem(i, styles.tab, styles.tabActive))}
      </nav>
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
