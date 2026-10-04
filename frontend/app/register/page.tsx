"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import styles from "./register.module.css";

type FormData = {
  fullName: string;
  studentId: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
};

type FormErrors = Partial<Record<keyof FormData, string>>;

const UNIVERSITY_DOMAIN = "@helplive.edu.my";

export function validateRegistration(data: FormData): FormErrors {
  const errors: FormErrors = {};

  if (data.fullName.trim().length < 2) {
    errors.fullName = "Enter your full name.";
  }

  if (!/^B\d{7}$/i.test(data.studentId.trim())) {
    errors.studentId = "Student ID should look like BXXXXXXX.";
  }

  if (!data.email.trim().toLowerCase().endsWith(UNIVERSITY_DOMAIN)) {
    errors.email = `Use your university email ending in ${UNIVERSITY_DOMAIN}.`;
  }

  if (data.phone.trim() !== "" && !/^\+?[\d\s-]{9,15}$/.test(data.phone.trim())) {
    errors.phone = "Enter a valid phone number, e.g. 012-345 6789.";
  }

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
  const [submitted, setSubmitted] = useState(false);

  function handleChange(field: keyof FormData, value: string) {
    setForm({ ...form, [field]: value });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); // stop the browser from reloading the page

    const foundErrors = validateRegistration(form);
    setErrors(foundErrors);

    if (Object.keys(foundErrors).length > 0) {
      return; // there are errors, so don't continue
    }

    // TODO (next step): call Supabase Auth signUp here
    setSubmitted(true);
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

          {submitted && (
            <p className={styles.success}>
              Details look good. Account creation will be connected to Supabase in the next step.
            </p>
          )}

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
              placeholder="B2400089"
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

            <button type="submit" className={styles.submit}>
              Create account
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
