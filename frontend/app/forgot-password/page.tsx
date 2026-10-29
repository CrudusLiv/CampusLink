"use client";

// Forgot Password page (Epic 1 – User Story 8)
// Sends a one-time password reset link to the student's university email.

import { useState, FormEvent } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import AuthLayout from "@/components/auth/AuthLayout";
// Reuse the same form styles as the register and login pages
import styles from "../register/register.module.css";

const UNIVERSITY_DOMAIN = "@helplive.edu.my";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!email.trim().toLowerCase().endsWith(UNIVERSITY_DOMAIN)) {
      setError(`Use your university email ending in ${UNIVERSITY_DOMAIN}.`);
      return;
    }

    setLoading(true);
    const { error: sendError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      // The link in the email opens this page
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);

    if (sendError && sendError.message.toLowerCase().includes("rate limit")) {
      setError("Too many reset requests. Wait a few minutes and try again.");
      return;
    }

    // Same message whether or not the account exists (US8 acceptance criteria),
    // so nobody can use this form to find out which emails are registered.
    setSent(true);
  }

  return (
    <AuthLayout>
      <h1 className={styles.title}>Forgot your password?</h1>

      {sent ? (
        <p className={styles.success}>
          If an account exists for {email.trim().toLowerCase()}, we&apos;ve sent a password reset link to it.
          The link expires in 5 minutes.
        </p>
      ) : (
        <>
          <p className={styles.subtitle}>
            Enter your HELP University email and we&apos;ll send you a link to reset your password.
          </p>

          {error && <p className={styles.serverError}>{error}</p>}

          <form onSubmit={handleSubmit} noValidate className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="email" className={styles.label}>
                University email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="bxxxxxxx@helplive.edu.my"
                className={styles.input}
              />
            </div>

            <button type="submit" className={styles.submit} disabled={loading}>
              {loading ? "Sending..." : "Send reset link"}
            </button>
          </form>
        </>
      )}

      <p className={styles.switch}>
        Remembered it? <Link href="/login">Back to log in</Link>
      </p>
    </AuthLayout>
  );
}
