"use client";

// Volunteer Skills & Availability page (Epic 1 – User Story 2)
// A volunteer picks subject tags and the hours they're free each week.
// Saved with one database function so skills and slots are stored together.
// Volunteers can also add their own subject if it isn't in the list.

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

const MAX_SUBJECT_LENGTH = 40;

// Tidies a typed subject: trims spaces and reuses the list's spelling if it already exists,
// so "database" and "Database" count as the same subject.
export function normaliseSubject(input: string, existing: string[]) {
  const cleaned = input.trim().replace(/\s+/g, " ");
  const match = existing.find((s) => s.toLowerCase() === cleaned.toLowerCase());
  return match ?? cleaned;
}

// Kept separate so they can be unit tested later
export function validateNewSubject(input: string, skills: string[]) {
  const cleaned = input.trim();
  if (cleaned === "") return "Type a subject first.";
  if (cleaned.length > MAX_SUBJECT_LENGTH) return `Keep it under ${MAX_SUBJECT_LENGTH} characters.`;
  if (skills.some((s) => s.toLowerCase() === cleaned.toLowerCase())) return "You've already added this subject.";
  return "";
}

// A short "fingerprint" of the choices, used to tell if anything changed since the last save
export function setupSignature(skills: string[], cells: Set<string>) {
  return JSON.stringify([[...skills].sort(), [...cells].sort()]);
}

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
  const [newSubject, setNewSubject] = useState("");
  const [subjectError, setSubjectError] = useState("");
  const [savedSignature, setSavedSignature] = useState("");

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
      setSavedSignature(setupSignature(vp?.skills ?? [], saved));
    }

    load();
  }, [profile]);

  function toggleSkill(subject: string) {
    setMessage("");
    setSkills((current) =>
      current.includes(subject) ? current.filter((s) => s !== subject) : [...current, subject]
    );
  }

  function addSubject() {
    const problem = validateNewSubject(newSubject, skills);
    setSubjectError(problem);
    if (problem) return;

    setMessage("");
    setSkills((current) => [...current, normaliseSubject(newSubject, [...SUBJECTS])]);
    setNewSubject("");
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
    if (Object.keys(foundErrors).length > 0) {
      setServerError("Please fix the highlighted parts above.");
      return;
    }

    // Nothing changed since the last save: no need to call the database
    if (setupSignature(skills, cells) === savedSignature) {
      setMessage("No changes to save. Your skills and availability are already up to date.");
      return;
    }

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
    setSavedSignature(setupSignature(skills, cells));
    setMessage("Saved. Students can now find you in the volunteer list.");
  }

  // The list's subjects first, then any the volunteer added themselves
  const customSkills = skills.filter((s) => !(SUBJECTS as readonly string[]).includes(s));
  const allSubjects = [...SUBJECTS, ...customSkills];

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

              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Subjects you can help with</h2>
                <div className={styles.tags}>
                  {allSubjects.map((subject) => {
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

                {/* Add a subject that isn't in the list */}
                <div className={styles.addRow}>
                  <label htmlFor="new-subject" className={styles.srOnly}>
                    Add another subject
                  </label>
                  <input
                    id="new-subject"
                    value={newSubject}
                    maxLength={MAX_SUBJECT_LENGTH + 10}
                    placeholder="Add another subject, e.g. Accounting"
                    onChange={(e) => {
                      setNewSubject(e.target.value);
                      setSubjectError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addSubject();
                      }
                    }}
                    className={subjectError ? `${styles.addInput} ${styles.addInputError}` : styles.addInput}
                  />
                  <button type="button" onClick={addSubject} className={styles.addButton}>
                    + Add
                  </button>
                </div>
                {subjectError && <p className={styles.error}>{subjectError}</p>}
                {customSkills.length > 0 && (
                  <p className={styles.hint}>Click a subject again to remove it.</p>
                )}
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
                          <th className={styles.timeLabel}>
                            {toTime(hour)}–{toTime(hour + 1)}
                          </th>
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

              {/* Save bar stays at the bottom of the screen, so the result is always visible */}
              <div className={styles.saveBar}>
                <button type="button" onClick={handleSave} className={styles.submit} disabled={saving}>
                  {saving ? "Saving..." : "Save availability"}
                </button>
                <div role="status" aria-live="polite" className={styles.saveStatus}>
                  {message && <p className={styles.success}>✓ {message}</p>}
                  {serverError && <p className={styles.serverError}>{serverError}</p>}
                </div>
              </div>
            </>
          )}
          </div>
        </main>
      </div>
    </AppShell>
  );
}
