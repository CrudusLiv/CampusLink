import styles from './page.module.css';
import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className={styles.container}>
      {/* Top Navigation */}
      <header className={styles.header}>
        <div className={styles.logo}>CampusLink</div>
        <div className={styles.navButtons}>
          <button className={styles.btnOutline}>Log In</button>
          <Link href="/register" className={styles.btnFilled}>Register</Link>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.main}>
        
        {/* Top Half: Hero Section */}
        <section className={styles.hero}>
          <div className={styles.heroText}>
            <h1 className={styles.heroTitle}>Peer Support, Made Simple.</h1>
            <p className={styles.heroDesc}>
              CampusLink connects HELP University students with peer volunteers for academic support, campus orientation, and more.
            </p>
            <div className={styles.heroButtons}>
              <Link href="/register" className={styles.btnFilled}>Get Started</Link>
              <button className={styles.btnOutline}>Log In</button>
            </div>
          </div>
          
          <div className={styles.heroImagePlaceholder}>
            Hero Illustration
          </div>
        </section>

        {/* Bottom Half: Features Section */}
        <section className={styles.features}>
          
          {/* Card 1 */}
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Ask for Support</h3>
            <p className={styles.cardDesc}>
              Submit a request and get matched with a peer volunteer who can help with your topic.
            </p>
            <a href="#" className={styles.cardLink}>
              <span>Submit a request</span>
              <span className={styles.cardIcon}>➔</span>
            </a>
          </div>

          {/* Card 2 */}
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Volunteer Your Skills</h3>
            <p className={styles.cardDesc}>
              Share your expertise and help peers through one-on-one sessions and support requests.
            </p>
            <a href="#" className={styles.cardLink}>
              <span>Share expertise</span>
              <span className={styles.cardIcon}>➔</span>
            </a>
          </div>

          {/* Card 3 */}
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Track Sessions</h3>
            <p className={styles.cardDesc}>
              Schedule, meet, and give feedback on sessions from one simple dashboard.
            </p>
            <a href="#" className={styles.cardLink}>
              <span>Schedule & review</span>
              <span className={styles.cardIcon}>➔</span>
            </a>
          </div>

        </section>
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        CampusLink - HELP University - © 2026
      </footer>
    </div>
  );
}