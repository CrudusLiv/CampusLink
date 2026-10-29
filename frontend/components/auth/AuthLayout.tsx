// Shared layout for the sign-in pages (Epic 1): log in, verification code,
// register, forgot password and reset password.
// Full-screen background photo, the CAMPUSLINK wordmark, an optional
// "Log in / Sign up" switch, optional welcome text, and a glass card for the form.

import Link from "next/link";
import type { ReactNode } from "react";
import { Space_Grotesk } from "next/font/google";
import styles from "./AuthLayout.module.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-display",
});

type Props = {
  children: ReactNode;
  // Which tab of the "Log in / Sign up" switch is active. Leave out to hide the switch.
  active?: "login" | "register";
  // Optional welcome text shown next to the card on wide screens (login page)
  heroEyebrow?: string;
  heroTitle?: string;
  heroText?: string;
  // Wider card for forms with two columns (register page)
  wide?: boolean;
};

export default function AuthLayout({ children, active, heroEyebrow, heroTitle, heroText, wide }: Props) {
  return (
    <div className={`${styles.page} ${display.variable}`}>
      <header className={styles.header}>
        <Link href="/" className={styles.wordmark}>
          CAMPUSLINK
        </Link>

        {active && (
          <nav aria-label="Account" className={styles.switch}>
            <Link
              href="/login"
              className={active === "login" ? styles.switchActive : styles.switchLink}
              aria-current={active === "login" ? "page" : undefined}
            >
              Log in
            </Link>
            <Link
              href="/register"
              className={active === "register" ? styles.switchActive : styles.switchLink}
              aria-current={active === "register" ? "page" : undefined}
            >
              Sign up
            </Link>
          </nav>
        )}
      </header>

      <main className={styles.main}>
        {heroTitle && (
          <section className={styles.hero}>
            {heroEyebrow && <p className={styles.heroEyebrow}>{heroEyebrow}</p>}
            <h2 className={styles.heroTitle}>{heroTitle}</h2>
            {heroText && <p className={styles.heroText}>{heroText}</p>}
          </section>
        )}

        <div className={wide ? `${styles.card} ${styles.cardWide}` : styles.card}>{children}</div>
      </main>
    </div>
  );
}
