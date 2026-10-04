"use client";

// Registration page for CampusLink (Epic 1 – FR1: register with university email)
// Validates the form, then creates the account with Supabase Auth.
// A database trigger (handle_new_user) copies the details into public.users.

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import styles from "./register.module.css";

// The shape of the form data
type FormData = {
  fullName: string;
  studentId: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
};

// One error message per field (empty = no error)
type FormErrors = Partial<Record<keyof FormData, string>>;

const UNIVERSITY_DOMAIN = "@helplive.edu.my";

// Checks every field and returns the error messages.
// Kept as a separate function so it can be unit tested later with Vitest.
export function validateRegistration(data: FormData): FormErrors {
  const errors: FormErrors = {};

  if (data.fullName.trim().length < 2) {
    errors.fullName = "Enter your full name.";
  }

  // HELP student IDs look like B2400089 (letter B + 7 digits)
  if (!/^B\d{7}$/i.test(data.studentId.trim())) {
    errors.studentId = "Student ID should look like BXXXXXXX.";
  }

  if (!data.email.trim().toLowerCase().endsWith(UNIVERSITY_DOMAIN)) {
    errors.email = `Use your university email ending in ${UNIVERSITY_DOMAIN}.`;
  }

  // Phone is optional, but if filled in it must be digits (spaces, + and - allowed)
  if (data.phone.trim() !== "" && !/^\+?[\d\s-]{9,15}$/.test(data.phone.trim())) {
    errors.phone = "Enter a valid phone number, e.g. 012-345 6789.";
  }

  // Same password rule as User Story 8: at least 8 characters, 1 uppercase, 1 number
  if (
    data.password.length < 8 ||
    !/[A-Z]/.test(data.password) ||
    !/\d/.test(data.password)
  ) {
    errors.password =
      "Password needs at least 8 characters, 1 uppercase letter and 1 number.";
  }

  if (data.confirmPassword !== data.password) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return errors;
}

export default function RegisterPage() {
  const [form, setForm] = useState<FormData>({
    fullName: "",
    studentId: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false); // true while waiting for Supabase
  const [serverError, setServerError] = useState(""); // error returned by Supabase
  const [checkEmail, setCheckEmail] = useState(false); // account created, waiting for email confirmation
  const router = useRouter();

  // Updates one field when the user types
  function handleChange(field: keyof FormData, value: string) {
    setForm({ ...form, [field]: value });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); // stop the browser from reloading the page
    setServerError("");

    const foundErrors = validateRegistration(form);
    setErrors(foundErrors);

    if (Object.keys(foundErrors).length > 0) {
      return; // there are errors, so don't continue
    }

    setLoading(true);

    // Create the account in Supabase Auth.
    // The extra details go into "data" so the database trigger can save them in public.users.
    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim().toLowerCase(),
      password: form.password,
      options: {
        data: {
          full_name: form.fullName.trim(),
          student_id: form.studentId.trim().toUpperCase(),
          phone: form.phone.trim(),
        },
      },
    });

    setLoading(false);

    if (error) {
      setServerError(friendlyError(error.message));
      return;
    }

    // Supabase returns a user with no identities when the email is already registered
    if (data.user && data.user.identities?.length === 0) {
      setServerError("An account with this email already exists. Try logging in instead.");
      return;
    }

    if (data.session) {
      // Email confirmation is turned off, so the user is already logged in
      router.push("/dashboard");
    } else {
      // Email confirmation is turned on, so the user must confirm first
      setCheckEmail(true);
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.logo}>
          CampusLink
        </Link>
      </header>

      <main className={styles.main}>
        <div className={styles.card}>
          <h1 className={styles.title}>Create your account</h1>
          <p className={styles.subtitle}>
            Sign up with your HELP University email to ask for or offer peer support.
          </p>

          {checkEmail && (
            <p className={styles.success}>
              Account created. Check your university inbox for a confirmation email, then log in.
            </p>
          )}

          {serverError && <p className={styles.serverError}>{serverError}</p>}

          <form onSubmit={handleSubmit} noValidate className={styles.form}>
            <Field
              label="Full name"
              value={form.fullName}
              error={errors.fullName}
              onChange={(v) => handleChange("fullName", v)}
            />
            <Field
              label="Student ID"
              value={form.studentId}
              error={errors.studentId}
              placeholder="BXXXXXXX"
              onChange={(v) => handleChange("studentId", v)}
            />
            <Field
              label="University email"
              type="email"
              value={form.email}
              error={errors.email}
              placeholder="b2400089@helplive.edu.my"
              onChange={(v) => handleChange("email", v)}
            />
            <Field
              label="Phone number (optional)"
              type="tel"
              value={form.phone}
              error={errors.phone}
              onChange={(v) => handleChange("phone", v)}
            />
            <Field
              label="Password"
              type="password"
              value={form.password}
              error={errors.password}
              onChange={(v) => handleChange("password", v)}
            />
            <Field
              label="Confirm password"
              type="password"
              value={form.confirmPassword}
              error={errors.confirmPassword}
              onChange={(v) => handleChange("confirmPassword", v)}
            />

            <button type="submit" className={styles.submit} disabled={loading}>
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className={styles.switch}>
            Already have an account? <Link href="/login">Log in</Link>
          </p>
        </div>
      </main>
    </div>
  );
}

// Turns Supabase error messages into messages a student can act on
function friendlyError(message: string): string {
  const text = message.toLowerCase();
  if (text.includes("already registered")) {
    return "An account with this email already exists. Try logging in instead.";
  }
  if (text.includes("database error")) {
    return "We couldn't create your account. This student ID may already be registered.";
  }
  if (text.includes("rate limit")) {
    return "Too many sign-up attempts. Wait a few minutes and try again.";
  }
  return message;
}

// A reusable input with a label and an error message underneath
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
        aria-invalid={props.error ? true : false}
      />
      {props.error && <p className={styles.error}>{props.error}</p>}
    </div>
  );
}
