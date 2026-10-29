// Landing page (localhost:3000 / campuslink216.vercel.app)
// Photo background, big title, and the three things CampusLink lets students do.
// Styles are in landing.module.css (page.module.css is still used by the dashboard).

import Link from "next/link";
import { Space_Grotesk } from "next/font/google";
import styles from "./landing.module.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-display",
});

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export default function LandingPage() {
  return (
    <div className={`${styles.container} ${display.variable}`}>
      {/* Top Navigation */}
      <header className={styles.header}>
        <span className={styles.logo}>CAMPUSLINK</span>
        <div className={styles.navButtons}>
          <Link href="/login" className={styles.btnOutline}>
            Log In
          </Link>
          <Link href="/register" className={styles.btnFilled}>
            Register
          </Link>
        </div>
      </header>

      <main className={styles.main}>
        {/* Hero Section */}
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>
            Peer Support,
            <br />
            Made Simple.
          </h1>
          <p className={styles.heroDesc}>
            CampusLink connects HELP University students with peer volunteers for academic support, campus
            orientation, and more.
          </p>
          <div className={styles.heroButtons}>
            <Link href="/register" className={styles.btnFilledLarge}>
              Get Started
            </Link>
            <Link href="/login" className={styles.btnOutlineLarge}>
              Log In
            </Link>
          </div>
        </section>

        {/* Features Section */}
        <section className={styles.featuresWrap} aria-labelledby="features-title">
          <p id="features-title" className={styles.featuresEyebrow}>
            WHAT YOU CAN DO
          </p>
          <div className={styles.features}>
            <article className={`${styles.card} ${styles.cardStudent}`}>
              <span className={styles.cardNumber} aria-hidden="true">01</span>
              <span className={styles.cardIcon}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
                </svg>
              </span>
              <h2 className={styles.cardTitle}>Ask for Support</h2>
              <p className={styles.cardDesc}>
                Submit a request and get matched with a peer volunteer who can help with your topic.
              </p>
              <Link href="/register" className={styles.cardLink}>
                Submit a request <ArrowIcon />
              </Link>
            </article>

            <article className={`${styles.card} ${styles.cardVolunteer}`}>
              <span className={styles.cardNumber} aria-hidden="true">02</span>
              <span className={styles.cardIcon}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 3l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8-4.3-4.1 5.9-.8z" />
                </svg>
              </span>
              <h2 className={styles.cardTitle}>Volunteer Your Skills</h2>
              <p className={styles.cardDesc}>
                Share your expertise and help peers through one-on-one sessions and support requests.
              </p>
              <Link href="/register" className={styles.cardLink}>
                Share expertise <ArrowIcon />
              </Link>
            </article>

            <article className={`${styles.card} ${styles.cardSessions}`}>
              <span className={styles.cardNumber} aria-hidden="true">03</span>
              <span className={styles.cardIcon}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="16" rx="2" />
                  <path d="M3 10h18M8 3v4M16 3v4" />
                </svg>
              </span>
              <h2 className={styles.cardTitle}>Track Sessions</h2>
              <p className={styles.cardDesc}>
                Schedule, meet, and give feedback on sessions from one simple dashboard.
              </p>
              <Link href="/login" className={styles.cardLink}>
                Schedule &amp; review <ArrowIcon />
              </Link>
            </article>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className={styles.footer}>CampusLink · HELP University · © 2026</footer>
    </div>
  );
}
