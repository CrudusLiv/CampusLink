"use client";

// My Profile page (Epic 1 – User Story 5)
// Shows the logged-in student's details from public.users.
// Name, phone, faculty and bio can be edited; student ID and email are locked.

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/lib/useCurrentUser";
import LogoutButton from "@/components/auth/LogoutButton";
import styles from "./profile.module.css";

type ProfileForm = {
  name: string;
  phone: string;
  faculty: string;
  bio: string;
};

type ProfileErrors = Partial<Record<keyof ProfileForm, string>>;

const BIO_MAX = 300;

// Kept separate so it can be unit tested later
export function validateProfile(form: ProfileForm): ProfileErrors {
  const errors: ProfileErrors = {};

  if (form.name.trim().length < 2 || form.name.trim().length > 100) {
    errors.name = "Name must be between 2 and 100 characters.";
  }
  if (form.phone.trim() !== "" && !/^\+?[\d\s-]{9,15}$/.test(form.phone.trim())) {
    errors.phone = "Enter a valid phone number, e.g. 012-345 6789.";
  }
  if (form.faculty.trim().length > 100) {
    errors.faculty = "Faculty must be 100 characters or less.";
  }
  if (form.bio.length > BIO_MAX) {
    errors.bio = `Bio must be ${BIO_MAX} characters or less.`;
  }

  return errors;
}

export default function ProfilePage() {
  const { profile } = useCurrentUser();
  const [form, setForm] = useState<ProfileForm>({ name: "", phone: "", faculty: "", bio: "" });
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [serverError, setServerError] = useState("");

  // Fill the form once the profile has loaded from the database
  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name ?? "",
        phone: profile.contact_no ?? "",
        faculty: profile.faculty ?? "",
        bio: profile.bio ?? "",
      });
    }
  }, [profile]);

  function handleChange(field: keyof ProfileForm, value: string) {
    setForm({ ...form, [field]: value });
    setMessage(""); // hide the old success message once the user edits again
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setServerError("");

    const foundErrors = validateProfile(form);
    setErrors(foundErrors);
    if (Object.keys(foundErrors).length > 0 || !profile) {
      return;
    }

    setSaving(true);
    // RLS only allows a student to update their OWN row
    const { error } = await supabase
      .from("users")
      .update({
        name: form.name.trim(),
        contact_no: form.phone.trim() || null,
        faculty: form.faculty.trim() || null,
        bio: form.bio.trim() || null,
      })
      .eq("user_id", profile.user_id);
    setSaving(false);

    if (error) {
      setServerError("We couldn't save your changes. Please try again.");
      return;
    }
    setMessage("Profile updated successfully.");
  }

  if (!profile) {
    return null; // AuthGuard shows "Loading..." until the profile is ready
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/dashboard" className={styles.logo}>
          CampusLink
        </Link>
        <div className={styles.headerLinks}>
          <Link href="/dashboard" className={styles.backLink}>
            ← Back to dashboard
          </Link>
          <LogoutButton className={styles.logoutButton} />
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.card}>
          <h1 className={styles.title}>My Profile</h1>
          <p className={styles.subtitle}>
            Keep your details up to date so other students and volunteers know who you are.
          </p>

          {message && <p className={styles.success}>{message}</p>}
          {serverError && <p className={styles.serverError}>{serverError}</p>}

          {/* Locked fields (User Story 5: student ID and email cannot be changed) */}
          <div className={styles.lockedRow}>
            <div className={styles.field}>
              <span className={styles.label}>Student ID</span>
              <input value={profile.student_id} disabled className={styles.input} />
            </div>
            <div className={styles.field}>
              <span className={styles.label}>University email</span>
              <input value={profile.email} disabled className={styles.input} />
            </div>
          </div>
          <p className={styles.lockNote}>
            Student ID and email are linked to your university account and can't be changed.
          </p>

          <form onSubmit={handleSave} noValidate className={styles.form}>
            <Field
              label="Full name"
              value={form.name}
              error={errors.name}
              onChange={(v) => handleChange("name", v)}
            />
            <Field
              label="Phone number (optional)"
              type="tel"
              value={form.phone}
              error={errors.phone}
              onChange={(v) => handleChange("phone", v)}
            />
            <Field
              label="Faculty (optional)"
              value={form.faculty}
              error={errors.faculty}
              placeholder="e.g. Faculty of Computing and Digital Technology"
              onChange={(v) => handleChange("faculty", v)}
            />

            <div className={styles.field}>
              <label htmlFor="bio" className={styles.label}>
                Bio (optional)
              </label>
              <textarea
                id="bio"
                rows={4}
                value={form.bio}
                onChange={(e) => handleChange("bio", e.target.value)}
                placeholder="Tell others a little about yourself"
                className={errors.bio ? `${styles.input} ${styles.inputError}` : styles.input}
              />
              <span className={form.bio.length > BIO_MAX ? styles.counterOver : styles.counter}>
                {form.bio.length} / {BIO_MAX}
              </span>
              {errors.bio && <p className={styles.error}>{errors.bio}</p>}
            </div>

            <button type="submit" className={styles.submit} disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

function Field(props: {
  label: string;
  value: string;
  error?: string;
  type?: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const id = props.label.toLowerCase().replace(/[^a-z]+/g, "-");
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {props.label}
      </label>
      <input
        id={id}
        type={props.type ?? "text"}
        value={props.value}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
        className={props.error ? `${styles.input} ${styles.inputError}` : styles.input}
      />
      {props.error && <p className={styles.error}>{props.error}</p>}
    </div>
  );
}
