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

        </div>
    </AppShell>
  );
}
