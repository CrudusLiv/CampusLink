"use client";

import { useState } from 'react';
import styles from '../page.module.css';

export default function Dashboard() {
  const [role, setRole] = useState<'student' | 'admin'>('admin');

  const toggleRole = () => {
    setRole(role === 'student' ? 'admin' : 'student');
  };

  return (
    <div className={styles.layout}>
      
      {/* Sidebar - Conditional Rendering */}
      {role === 'student' ? (
        <aside className={styles.sidebarStudent}>
          <div className={styles.logo}>
            <div className={styles.logoIconDark}></div>
            CampusLink
          </div>
          <div className={styles.sidebarSection}>STUDENT</div>
          <nav className={styles.navMenu}>
            <a href="#" className={`${styles.navItemStudent} ${styles.navItemStudentActive}`}>Dashboard</a>
            <a href="#" className={styles.navItemStudent}>Ask for Support</a>
            <a href="#" className={styles.navItemStudent}>Volunteer List</a>
            <a href="#" className={styles.navItemStudent}>My Support Requests</a>
            <a href="#" className={styles.navItemStudent}>My Support Sessions</a>
            <a href="#" className={styles.navItemStudent}>Support History</a>
            <a href="#" className={styles.navItemStudent}>My Profile</a>
          </nav>
          <div className={`${styles.logout} ${styles.logoutStudent}`}>Log out</div>
        </aside>
      ) : (
        <aside className={styles.sidebarAdmin}>
          <div className={styles.logo}>
            <div className={styles.logoIconLight}></div>
            App Name
          </div>
          <div className={styles.sidebarSectionAdmin}>ADMIN</div>
          <nav className={styles.navMenu}>
            <a href="#" className={`${styles.navItemAdmin} ${styles.navItemAdminActive}`}>Overview</a>
            <a href="#" className={styles.navItemAdmin}>User Registrations</a>
          </nav>
          <div className={`${styles.logout} ${styles.logoutAdmin}`}>Log out</div>
        </aside>
      )}

      {/* Main Content Area */}
      <main className={styles.mainContent}>
        
        {/* Top Header */}
        <header className={styles.topHeader}>
          <h1 className={styles.headerTitle}>Dashboard</h1>
          <div className={styles.headerIcons}>
            <span 
              className={styles.iconPlaceholder} 
              style={{ cursor: 'pointer', color: 'blue' }} 
              onClick={toggleRole}
            >
              [Toggle Role: {role.toUpperCase()}]
            </span>
            <div className={styles.avatar}>Avatar</div>
          </div>
        </header>

        {/* Content Body - Conditional Rendering */}
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
      </main>

      {/* Mobile Bottom Navigation - Student Only */}
      {role === 'student' && (
        <nav className={styles.mobileNav}>
          <div className={styles.mobileNavItem}>
            <div className={styles.mobileNavIcon}></div>
            <span>Home</span>
          </div>
          <div className={styles.mobileNavItem}>
            <div className={styles.mobileNavIcon}></div>
            <span>Ask</span>
          </div>
          <div className={styles.mobileNavItem}>
            <div className={styles.mobileNavIcon}></div>
            <span>Requests</span>
          </div>
          <div className={styles.mobileNavItem}>
            <div className={styles.mobileNavIcon}></div>
            <span>Sessions</span>
          </div>
          <div className={styles.mobileNavItem}>
            <div className={styles.mobileNavIcon}></div>
            <span>Profile</span>
          </div>
        </nav>
      )}

    </div>
  );
}