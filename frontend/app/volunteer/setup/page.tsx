"use client";

// Volunteer Skills & Availability page (Epic 1 – User Story 2)
// A volunteer picks subject tags and the hours they're free each week.
// Saved with one database function so skills and slots are stored together.

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell, { AppShellLoading } from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { SUBJECTS, DAYS, Day } from "@/lib/categories";
import styles from "./setup.module.css";

// One-hour slots from 08:00 to 21:00
const HOURS = Array.from({ length: 13 }, (_, i) => 8 + i);

export type Slot = { day_of_week: Day; start_time: string; end_time: string };

function cellKey(day: Day, hour: number) {
  return `${day}-${hour}`;
}

function toTime(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

// Kept separate so they can be unit tested later
export function validateVolunteerSetup(skills: string[], cells: Set<string>) {
  const errors: { skills?: string; slots?: string } = {};
  if (skills.length === 0) {
    errors.skills = "Choose at least one subject tag.";
  }
  if (cells.size === 0) {
    errors.slots = "Choose at least one time slot.";
  }
  return errors;
}

// Turns selected hour cells into time ranges, e.g. Mon 10, 11 → Mon 10:00–12:00
export function cellsToSlots(cells: Set<string>): Slot[] {
  const slots: Slot[] = [];
  for (const day of DAYS) {
    const hours = HOURS.filter((h) => cells.has(cellKey(day, h)));
    let i = 0;
    while (i < hours.length) {
      const start = hours[i];
      // Walk forward while the hours are back-to-back
      while (i + 1 < hours.length && hours[i + 1] === hours[i] + 1) i++;
      slots.push({ day_of_week: day, start_time: toTime(start), end_time: toTime(hours[i] + 1) });
      i++;
    }
  }
  return slots;
}

export default function VolunteerSetupPage() {
  const { profile } = useCurrentUser();
  const [isVolunteer, setIsVolunteer] = useState<boolean | null>(null);
  const [skills, setSkills] = useState<string[]>([]);
  const [cells, setCells] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<{ skills?: string; slots?: string }>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [serverError, setServerError] = useState("");

  // Load the volunteer's saved skills and schedule
  useEffect(() => {
    if (!profile) return;

    async function load() {
      const { data: vp } = await supabase
        .from("volunteer_profile")
        .select("skills, is_volunteer")
        .eq("user_id", profile!.user_id)
        .maybeSingle();

      setIsVolunteer(Boolean(vp?.is_volunteer));
      setSkills(vp?.skills ?? []);

      const { data: rows } = await supabase
        .from("availability")
        .select("day_of_week, start_time, end_time")
        .eq("user_id", profile!.user_id);

      const saved = new Set<string>();
      (rows ?? []).forEach((row) => {
        const start = parseInt(row.start_time.slice(0, 2), 10);
        const end = parseInt(row.end_time.slice(0, 2), 10);
        for (let h = start; h < end; h++) saved.add(cellKey(row.day_of_week, h));
      });
      setCells(saved);
    }

    load();
  }, [profile]);

  function toggleSkill(subject: string) {
    setMessage("");
    setSkills((current) =>
      current.includes(subject) ? current.filter((s) => s !== subject) : [...current, subject]
    );
  }

  function toggleCell(day: Day, hour: number) {
    setMessage("");
    setCells((current) => {
      const next = new Set(current);
      const key = cellKey(day, hour);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSave() {
    setMessage("");
    setServerError("");

    const foundErrors = validateVolunteerSetup(skills, cells);
    setErrors(foundErrors);
    if (Object.keys(foundErrors).length > 0) return;

    setSaving(true);
    const { error } = await supabase.rpc("save_volunteer_setup", {
      p_skills: skills,
      p_slots: cellsToSlots(cells),
    });
    setSaving(false);

    if (error) {
      setServerError("We couldn't save your availability. Please try again.");
      return;
    }
    setMessage("Saved. Students can now find you in the volunteer list.");
  }

  if (!profile || isVolunteer === null) {
    // Keep the layout on screen while the saved skills and schedule load (returning nothing blanked the page)
    return <AppShellLoading title="Skills & Availability" />;
  }

  return (
    <AppShell title="Skills & Availability">
      <div className={styles.page}>
        <main className={styles.main}>
          <div className={styles.card}>
          {!isVolunteer ? (
            <p className={styles.notice}>
              You need to become a volunteer before setting your skills.{" "}
              <Link href="/profile">Go to my profile</Link> and choose “Become a volunteer”.
            </p>
          ) : (
            <>
              <p className={styles.subtitle}>
                Pick what you can help with and when you're free each week. Students searching for
                help will see you when your subjects and times match.
              </p>

              {message && <p className={styles.success}>{message}</p>}
              {serverError && <p className={styles.serverError}>{serverError}</p>}

              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Subjects you can help with</h2>
                <div className={styles.tags}>
                  {SUBJECTS.map((subject) => {
                    const selected = skills.includes(subject);
                    return (
                      <button
                        key={subject}
                        type="button"
                        onClick={() => toggleSkill(subject)}
                        aria-pressed={selected}
                        className={selected ? `${styles.tag} ${styles.tagSelected}` : styles.tag}
                      >
                        {subject}
                      </button>
                    );
                  })}
                </div>
                {errors.skills && <p className={styles.error}>{errors.skills}</p>}
              </section>

              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Weekly availability</h2>
                <p className={styles.hint}>Click the hours you're free. Click again to remove.</p>
                <div className={styles.gridWrap}>
                  <table className={styles.grid}>
                    <thead>
                      <tr>
                        <th className={styles.timeHead}></th>
                        {DAYS.map((day) => (
                          <th key={day}>{day}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {HOURS.map((hour) => (
                        <tr key={hour}>
                          <th className={styles.timeLabel}>{toTime(hour)}</th>
                          {DAYS.map((day) => {
                            const selected = cells.has(cellKey(day, hour));
                            return (
                              <td key={day}>
                                <button
                                  type="button"
                                  onClick={() => toggleCell(day, hour)}
                                  aria-pressed={selected}
                                  aria-label={`${day} ${toTime(hour)} to ${toTime(hour + 1)}`}
                                  className={selected ? `${styles.cell} ${styles.cellSelected}` : styles.cell}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {errors.slots && <p className={styles.error}>{errors.slots}</p>}
              </section>

              <button type="button" onClick={handleSave} className={styles.submit} disabled={saving}>
                {saving ? "Saving..." : "Save availability"}
              </button>
            </>
          )}
          </div>
        </main>
      </div>
    </AppShell>
  );
}
