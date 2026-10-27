import Link from 'next/link';
import { UpcomingSessions } from './UpcomingSessions';
import s from './sessions.module.css';

/** The "Upcoming sessions" block for the student and volunteer dashboards: heading, list, and a link to the full page. */
export function UpcomingSessionsSection() {
  return (
    <section className={s.dashSection} aria-labelledby="dash-upcoming-title">
      <div className={s.dashHeader}>
        <h2 id="dash-upcoming-title" className={s.sectionTitle}>Next sessions</h2>
        <Link className={s.backLink} href="/sessions">Manage all sessions</Link>
      </div>
      {/* The dashboard is a quick glance (next 3); My Sessions is where you book, open and manage them. */}
      <UpcomingSessions limit={3} />
    </section>
  );
}
