"use client";

import styles from "../page.module.css";
import AppShell from "@/components/layout/AppShell";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { useVolunteerDashboardView } from "@/components/dashboard/VolunteerViewContext";
import VolunteerDashboard from "@/components/dashboard/VolunteerDashboard";
import StudentDashboard from "@/components/dashboard/StudentDashboard";

export default function Dashboard() {
  const { profile, loading } = useCurrentUser();
  const { view } = useVolunteerDashboardView();
  // Role comes from the signed-in user (public.users.role), not a toggle
  const role = profile?.role === "admin" ? "admin" : "student";

  if (loading) return <AppShell title="Dashboard">{null}</AppShell>;

  if (role === "student" && view === "volunteer") {
    return <AppShell title="Dashboard"><VolunteerDashboard /></AppShell>;
  }
  if (role === "student") return <AppShell title="Dashboard"><StudentDashboard /></AppShell>;

  return (
    <AppShell title="Dashboard">
        <div className={styles.contentBody}>
          
          {role === 'student' ? (
            /* Student View */
            <>
              <div className={styles.actionButtons}>
                <button className={styles.btnPrimary}>Submit New Request</button>
                <button className={styles.btnSecondary}>Browse Volunteers</button>
              </div>

              <div className={styles.studentGrid}>
                
                <div>
                  <h2 className={styles.sectionTitle}>My Requests</h2>
                  <div className={styles.requestList}>
                    <div className={styles.requestCard}>
                      <div className={styles.requestInfo}>
                        <h4>Math tutoring</h4>
                        <p>Tue 21 Sep · 4:00 PM · Online</p>
                      </div>
                      <span className={`${styles.badge} ${styles.badgePending}`}>Pending</span>
                    </div>
                    <div className={styles.requestCard}>
                      <div className={styles.requestInfo}>
                        <h4>Laptop setup</h4>
                        <p>Wed 22 Sep · 2:00 PM · In person</p>
                      </div>
                      <span className={`${styles.badge} ${styles.badgeAccepted}`}>Accepted</span>
                    </div>
                    <div className={styles.requestCard}>
                      <div className={styles.requestInfo}>
                        <h4>Campus tour</h4>
                        <p>Mon 19 Sep · 10:30 AM · In person</p>
                      </div>
                      <span className={`${styles.badge} ${styles.badgeCompleted}`}>Completed</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h2 className={styles.sectionTitle}>Suggested Volunteers For You</h2>
                  <p className={styles.sectionSubtitle}>Updates as you pick a category and time</p>
                  <div className={styles.volunteerList}>
                    <div className={styles.volunteerCard}>
                      <div className={styles.volunteerInfo}>
                        <div className={styles.volunteerAvatar}>Avatar</div>
                        <div className={styles.volunteerText}>
                          <h4>Jane D.</h4>
                          <p>Math</p>
                        </div>
                      </div>
                      <button className={styles.btnAction}>[Request]</button>
                    </div>
                    <div className={styles.volunteerCard}>
                      <div className={styles.volunteerInfo}>
                        <div className={styles.volunteerAvatar}>Avatar</div>
                        <div className={styles.volunteerText}>
                          <h4>Ali R.</h4>
                          <p>IT Help</p>
                        </div>
                      </div>
                      <button className={styles.btnAction}>[Request]</button>
                    </div>
                  </div>
                </div>

              </div>
            </>
          ) : (
            /* Admin View */
            <>
              <div className={styles.metricsGrid}>
                <div className={styles.metricCard}>Total users : xxx</div>
                <div className={styles.metricCard}>Active volunteers : xxx</div>
                <div className={styles.metricCard}>Pending sign-ups</div>
              </div>

              <div className={styles.adminMiddleGrid}>
                
                <div className={styles.chartPlaceholder}>
                  Chart: Support Requests
                </div>
                
                <div>
                  <h2 className={styles.sectionTitle}>Needs attention</h2>
                  <div className={styles.attentionList}>
                    <div className={styles.attentionCard}>
                      <span>Attention Title</span>
                      <span className={styles.attentionBadge}>Num</span>
                    </div>
                  </div>
                </div>

              </div>

              <div>
                <h2 className={styles.sectionTitle}>Recent activity</h2>
                <div className={styles.tableContainer}>
                  <table className={styles.activityTable}>
                    <thead>
                      <tr>
                        <th>Activity</th>
                        <th>User</th>
                        <th>Type</th>
                        <th>When</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Activity Title</td>
                        <td>Help Seeker / Volunteer</td>
                        <td><span className={styles.typeBadge}>Type</span></td>
                        <td>Time</td>
                      </tr>
                      <tr>
                        <td>Activity Title</td>
                        <td>Help Seeker / Volunteer</td>
                        <td><span className={styles.typeBadge}>Type</span></td>
                        <td>Time</td>
                      </tr>
                      <tr>
                        <td>Activity Title</td>
                        <td>Help Seeker / Volunteer</td>
                        <td><span className={styles.typeBadge}>Type</span></td>
                        <td>Time</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

        </div>
    </AppShell>
  );
}
