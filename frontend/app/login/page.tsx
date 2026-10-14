"use client";

// Login page for CampusLink (Epic 1 – User Story 1)
// Logs the student in with Supabase Auth (email + password),
// then sends them to the dashboard.

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
// Reuse the same card/form styles as the register page
import styles from "../register/register.module.css";

const UNIVERSITY_DOMAIN = "@helplive.edu.my";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    // Client-side checks before calling Supabase
    if (!email.trim().toLowerCase().endsWith(UNIVERSITY_DOMAIN)) {
      setError(`Use your university email ending in ${UNIVERSITY_DOMAIN}.`);
      return;
    }
    if (password === "") {
      setError("Enter your password.");
      return;
    }

    setLoading(true);
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setLoading(false);

    if (loginError) {
      // Same message for wrong email OR wrong password,
      // so attackers can't find out which emails are registered.
      setError("Incorrect email or password.");
      return;
    }

    router.push("/dashboard");
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
          <h1 className={styles.title}>Log in</h1>
          <p className={styles.subtitle}>Welcome back! Log in with your HELP University email.</p>

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

            <div className={styles.field}>
              <label htmlFor="password" className={styles.label}>
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.input}
              />
            </div>

            <button type="submit" className={styles.submit} disabled={loading}>
              {loading ? "Logging in..." : "Log in"}
            </button>
            <Link href="/forgot-password" className={styles.forgotLink}>Forgot password?</Link>
          </form>

          <p className={styles.switch}>
            New to CampusLink? <Link href="/register">Create an account</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
