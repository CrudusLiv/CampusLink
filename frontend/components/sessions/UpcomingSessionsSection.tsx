import Link from 'next/link';
import { UpcomingSessions } from './UpcomingSessions';
import s from './sessions.module.css';

/** The "Upcoming sessions" block for the student and volunteer dashboards: heading, list, and a link to the full page. */
export function UpcomingSessionsSection() {
  return (
    <section className={s.dashSection} aria-labelledby="dash-upcoming-title">
      <div className={s.dashHeader}>
        <h2 id="dash-upcoming-title" className={s.sectionTitle}>Upcoming sessions</h2>
        <Link className={s.backLink} href="/sessions">View all</Link>
      </div>
      <UpcomingSessions />
    </section>
  );
}
