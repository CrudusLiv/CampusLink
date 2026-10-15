"use client";

// "Become a volunteer" card for the profile page (Epic 1 – User Story 6).
// Not a volunteer yet → shows a button that opens the guidelines pop-up.
// Already a volunteer → shows a link to edit skills & availability.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useVolunteerDashboardView } from "@/components/dashboard/VolunteerViewContext";
import { supabase } from "@/lib/supabaseClient";
import styles from "./BecomeVolunteerCard.module.css";

export default function BecomeVolunteerCard({ userId }: { userId: string }) {
  const [isVolunteer, setIsVolunteer] = useState<boolean | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { view, setView } = useVolunteerDashboardView();

  useEffect(() => {
    supabase
      .from("volunteer_profile")
      .select("is_volunteer")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => setIsVolunteer(Boolean(data?.is_volunteer)));
  }, [userId]);

  async function handleConfirm() {
    setError("");
    if (!agreed) {
      setError("Tick the box to confirm you agree to the volunteer guidelines.");
      return;
    }

    setWorking(true);
    // Creates the volunteer_profile row (or turns is_volunteer back on)
    const { error: saveError } = await supabase
      .from("volunteer_profile")
      .upsert({ user_id: userId, is_volunteer: true });
    setWorking(false);

    if (saveError) {
      setError("Something went wrong. Please try again.");
      return;
    }

    // Next step of US6: set up skills and availability
    router.push("/volunteer/setup");
  }

  if (isVolunteer === null) return null;

  if (isVolunteer) {
    return (
      <div className={styles.card}>
        <div>
          <h2 className={styles.title}>You're a volunteer</h2>
          <p className={styles.text}>Keep your subjects and free times up to date so students can find you.</p>
        </div>
        <section className={styles.dashboardSwitch} aria-labelledby="dashboard-view-title">
          <div>
            <h3 id="dashboard-view-title" className={styles.switchTitle}>Choose dashboard view</h3>
            <p className={styles.text}>Switch between your student and volunteer dashboards.</p>
          </div>
          <div className={styles.switchButtons} role="group" aria-label="Dashboard view">
            <button
              type="button"
              className={view === "student" ? styles.switchButtonActive : styles.switchButton}
              aria-pressed={view === "student"}
              onClick={() => { setView("student"); router.push("/dashboard"); }}
            >Student</button>
            <button
              type="button"
              className={view === "volunteer" ? styles.switchButtonActive : styles.switchButton}
              aria-pressed={view === "volunteer"}
              onClick={() => { setView("volunteer"); router.push("/dashboard"); }}
            >Volunteer</button>
          </div>
        </section>
        <Link href="/volunteer/setup" className={styles.secondaryButton}>
          Edit skills &amp; availability
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className={styles.card}>
        <div>
          <h2 className={styles.title}>Want to help other students?</h2>
          <p className={styles.text}>Become a volunteer and appear in the student support directory.</p>
        </div>
        <button type="button" className={styles.primaryButton} onClick={() => setShowModal(true)}>
          Become a volunteer
        </button>
      </div>

      {showModal && (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="volunteer-title">
          <div className={styles.modal}>
            <h2 id="volunteer-title" className={styles.modalTitle}>
              Volunteer guidelines
            </h2>
            <ul className={styles.list}>
              <li>Be respectful and patient with every student you help.</li>
              <li>Reply to support requests promptly, even if you need to decline.</li>
              <li>Meet on campus or through Microsoft Teams / Google Meet only.</li>
              <li>Don't do assignments for other students. Help them understand instead.</li>
              <li>Keep other students' personal details private.</li>
            </ul>

            <label className={styles.checkboxRow}>
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              I agree to follow the volunteer guidelines
            </label>

            {error && (
              <p className={styles.error}>
                {error}{" "}
                {error.startsWith("Something") && (
                  <button type="button" className={styles.linkButton} onClick={handleConfirm}>
                    Retry
                  </button>
                )}
              </p>
            )}

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => {
                  setShowModal(false);
                  setError("");
                }}
              >
                Cancel
              </button>
              <button type="button" className={styles.primaryButton} onClick={handleConfirm} disabled={working}>
                {working ? "Setting up..." : "Become a volunteer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
