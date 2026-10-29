"use client";

// Reset Password page (Epic 1 – User Story 8)
// Opened from the link in the reset email. The student sets a new password,
// then every existing login session is signed out and they return to /login.
//
// Why there is a "Continue" button first:
// University Outlook (Microsoft Safe Links) opens every link in an email to scan
// it. A normal reset link can only be used once, so the scanner used it up before
// the student clicked it. Now the link only opens this page, and the one-time
// token is checked when the student presses "Continue" (scanners don't press buttons).

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AuthLayout from "@/components/auth/AuthLayout";
import { passwordRules } from "@/lib/passwordRules";
import styles from "../register/register.module.css";

type Status = "checking" | "confirm" | "ready" | "invalid" | "done";

// Same rule as registration: at least 8 characters, 1 uppercase letter and 1 number
export function validateNewPassword(password: string, confirm: string) {
  const errors: { password?: string; confirm?: string } = {};
  if (password.length < 8 || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    errors.password = "Password needs at least 8 characters, 1 uppercase letter and 1 number.";
  }
  if (confirm !== password) {
    errors.confirm = "Passwords do not match.";
  }
  return errors;
}

export default function ResetPasswordPage() {
  const [status, setStatus] = useState<Status>("checking");
  const [tokenHash, setTokenHash] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Link from the email: /reset-password?token_hash=...&type=recovery
    const params = new URLSearchParams(window.location.search);
    const hash = params.get("token_hash");
    if (hash && params.get("type") === "recovery") {
      setTokenHash(hash);
      setStatus("confirm");
      return;
    }

    // Supabase redirected here with an error (e.g. expired link)
    if (window.location.hash.includes("error")) {
      setStatus("invalid");
      return;
    }

    // Otherwise, only continue if there is already a recovery/login session
    supabase.auth.getSession().then(({ data }) => {
      setStatus(data.session ? "ready" : "invalid");
    });
  }, []);

  // Step 1: the student presses "Continue", which uses the one-time token
  async function handleContinue() {
    setVerifying(true);
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
    setVerifying(false);

    // Remove the token from the address bar so it isn't reused or shared
    window.history.replaceState(null, "", "/reset-password");

    setStatus(error ? "invalid" : "ready");
  }

  // Step 2: save the new password
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError("");

    const foundErrors = validateNewPassword(password, confirm);
    setErrors(foundErrors);
    if (Object.keys(foundErrors).length > 0) return;

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setSaving(false);
      setServerError(
        error.message.toLowerCase().includes("different")
          ? "Your new password must be different from your old one."
          : "We couldn't update your password. Request a new reset link and try again."
      );
      return;
    }

    // US8: log out every existing session (all devices), then go to login
    await supabase.auth.signOut({ scope: "global" });
    setSaving(false);
    setStatus("done");
    setTimeout(() => router.replace("/login"), 3000);
  }

  return (
    <AuthLayout>
      <h1 className={styles.title}>Set a new password</h1>

      {status === "checking" && <p className={styles.subtitle}>Checking your reset link...</p>}

      {status === "confirm" && (
        <>
          <p className={styles.subtitle}>Press continue to choose a new password for your account.</p>
          <button
            type="button"
            onClick={handleContinue}
            className={styles.submit}
            style={{ width: "100%" }}
            disabled={verifying}
          >
            {verifying ? "Checking link..." : "Continue"}
          </button>
        </>
      )}

      {status === "invalid" && (
        <>
          <p className={styles.serverError}>This reset link is invalid or has expired.</p>
          <p className={styles.switch}>
            <Link href="/forgot-password">Request a new reset link</Link>
          </p>
        </>
      )}

      {status === "done" && (
        <p className={styles.success}>
          Password updated. You&apos;ve been logged out everywhere. Taking you to the login page...
        </p>
      )}

      {status === "ready" && (
        <>
          <p className={styles.subtitle}>Use at least 8 characters with 1 uppercase letter and 1 number.</p>

          {serverError && <p className={styles.serverError}>{serverError}</p>}

          <form onSubmit={handleSubmit} noValidate className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="new-password" className={styles.label}>
                New password
              </label>
              <input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={errors.password ? `${styles.input} ${styles.inputError}` : styles.input}
              />
              <ul className={styles.checklist} aria-label="Password rules">
                {passwordRules(password).map((rule) => (
                  <li key={rule.text} className={rule.ok ? styles.checkOk : styles.checkTodo}>
                    {rule.text}
                  </li>
                ))}
              </ul>
              {errors.password && <p className={styles.error}>{errors.password}</p>}
            </div>

            <div className={styles.field}>
              <label htmlFor="confirm-password" className={styles.label}>
                Confirm new password
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={errors.confirm ? `${styles.input} ${styles.inputError}` : styles.input}
              />
              {errors.confirm && <p className={styles.error}>{errors.confirm}</p>}
            </div>

            <button type="submit" className={styles.submit} disabled={saving}>
              {saving ? "Saving..." : "Update password"}
            </button>
          </form>
        </>
      )}
    </AuthLayout>
  );
}
