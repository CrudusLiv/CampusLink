"use client";

// Login page for CampusLink (Epic 1 – User Story 1: two-factor authentication)
// Step 1: check the university email + password.
// Step 2: email a 6-digit code (valid 5 minutes). The student only gets a
//         logged-in session after entering the correct code.
// Only HELP University email + 2FA is offered (User Story 4 "Won't": no external
// social / Microsoft sign-in buttons on the login page).

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import AuthLayout from "@/components/auth/AuthLayout";
import OtpInput from "@/components/auth/OtpInput";
import styles from "../register/register.module.css";
import otpStyles from "@/components/auth/OtpInput.module.css";

const UNIVERSITY_DOMAIN = "@helplive.edu.my";
const CODE_VALID_SECONDS = 300; // 5 minutes (matches "Email OTP Expiration" in Supabase)
const RESEND_WAIT_SECONDS = 60; // matches the SMTP "minimum interval per user"
const MAX_ATTEMPTS = 5;
const LOCK_SECONDS = 60;

const EMPTY_CODE = ["", "", "", "", "", ""];

// Kept separate so it can be unit tested later
export function validateOtp(code: string): string {
  if (!/^\d{6}$/.test(code)) {
    return "Enter all 6 digits of the code from your email.";
  }
  return "";
}

function secondsUntil(time: number | null, now: number) {
  return time ? Math.max(0, Math.ceil((time - now) / 1000)) : 0;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function lockKey(email: string) {
  return `campuslink-otp-lock-${email}`;
}

export default function LoginPage() {
  const [step, setStep] = useState<"password" | "code">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [digits, setDigits] = useState<string[]>(EMPTY_CODE);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [now, setNow] = useState(Date.now());

  const cleanEmail = email.trim().toLowerCase();
  const codeSecondsLeft = secondsUntil(expiresAt, now);
  const resendSecondsLeft = secondsUntil(resendAt, now);
  const lockSecondsLeft = secondsUntil(lockedUntil, now);
  const isLocked = lockSecondsLeft > 0;
  const isExpired = expiresAt !== null && codeSecondsLeft === 0;

  // Coming from the register page: show a message and fill in the email
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("registered") === "1") {
      setNotice("Account created! Log in with your email and password. We'll then email you a 6-digit code to confirm it's you.");
    }
    const fromRegister = params.get("email");
    if (fromRegister) setEmail(fromRegister);
  }, []);

  // Tick every second while the code step is showing (countdown timers)
  useEffect(() => {
    if (step !== "code") return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [step]);

  // Remember a lock across page refreshes (browser storage is only a convenience)
  useEffect(() => {
    if (step !== "code") return;
    try {
      const saved = Number(localStorage.getItem(lockKey(cleanEmail)));
      if (saved > Date.now()) setLockedUntil(saved);
    } catch {
      // storage unavailable (e.g. private window) – the in-page lock still works
    }
  }, [step, cleanEmail]);

  async function sendCode() {
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: { shouldCreateUser: false }, // never create accounts from the login page
    });

    if (sendError) {
      setError(
        sendError.message.toLowerCase().includes("rate limit") || sendError.status === 429
          ? "Please wait a minute before requesting another code."
          : "We couldn't send your code. Please try again."
      );
      return false;
    }

    setDigits(EMPTY_CODE);
    setExpiresAt(Date.now() + CODE_VALID_SECONDS * 1000);
    setResendAt(Date.now() + RESEND_WAIT_SECONDS * 1000);
    setNow(Date.now());
    return true;
  }

  // Step 1: email + password
  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!cleanEmail.endsWith(UNIVERSITY_DOMAIN)) {
      setError(`Use your university email ending in ${UNIVERSITY_DOMAIN}.`);
      return;
    }
    if (password === "") {
      setError("Enter your password.");
      return;
    }

    setLoading(true);
    const { error: loginError } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });

    if (loginError) {
      setLoading(false);
      // Same message for wrong email OR wrong password
      setError("Incorrect email or password.");
      return;
    }

    // Password is correct. Drop this session on this device only – the real
    // session is only created after the emailed code is verified.
    await supabase.auth.signOut({ scope: "local" });

    await sendCode();
    setLoading(false);
    setPassword("");
    setStep("code");
  }

  // Step 2: 6-digit code
  async function handleCodeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (isLocked) return;
    if (isExpired) {
      setError("This code has expired. Send a new code.");
      return;
    }

    const code = digits.join("");
    const formatError = validateOtp(code);
    if (formatError) {
      setError(formatError);
      return;
    }

    setLoading(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: cleanEmail,
      token: code,
      type: "email",
    });
    setLoading(false);

    if (verifyError) {
      const used = attempts + 1;
      setDigits(EMPTY_CODE);

      if (used >= MAX_ATTEMPTS) {
        const until = Date.now() + LOCK_SECONDS * 1000;
        setLockedUntil(until);
        setAttempts(0);
        try {
          localStorage.setItem(lockKey(cleanEmail), String(until));
        } catch {
          // ignore storage errors
        }
        setError(`Too many incorrect codes. Try again in ${LOCK_SECONDS} seconds.`);
      } else {
        setAttempts(used);
        setError(`Incorrect code. ${MAX_ATTEMPTS - used} attempt${MAX_ATTEMPTS - used === 1 ? "" : "s"} left.`);
      }
      return;
    }

    // Verified: Supabase has issued the session (JSON Web Token)
    try {
      localStorage.removeItem(lockKey(cleanEmail));
    } catch {
      // ignore storage errors
    }
    // Full page load so the dashboard reads the new session from storage
    window.location.assign("/dashboard");
  }

  async function handleResend() {
    setError("");
    setLoading(true);
    const sent = await sendCode();
    setLoading(false);
    if (sent) setAttempts(0);
  }

  function backToPassword() {
    setStep("password");
    setDigits(EMPTY_CODE);
    setError("");
    setExpiresAt(null);
  }

  return (
    <AuthLayout
      active="login"
      heroEyebrow="HELP UNIVERSITY PEER SUPPORT"
      heroTitle="Welcome back. Someone's ready to help."
      heroText="Ask a fellow student for help, or volunteer your time. Book a session in a few steps."
    >
      {step === "password" ? (
        <>
          <div className={styles.step}>
            <span className={styles.stepBadge}>STEP 1 OF 2</span>
            <span className={styles.stepBarHalf} aria-hidden="true" />
          </div>
          <h1 className={styles.title}>Log in</h1>
          <p className={styles.subtitle}>Enter your HELP University email and password.</p>

          {notice && <p className={styles.success}>{notice}</p>}
          {error && <p className={styles.serverError}>{error}</p>}

          <form onSubmit={handlePasswordSubmit} noValidate className={styles.form}>
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
              <div className={styles.labelRow}>
                <label htmlFor="password" className={styles.label}>
                  Password
                </label>
                <Link href="/forgot-password" className={styles.forgotLink}>
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                className={styles.input}
              />
            </div>

            <button type="submit" className={styles.submit} disabled={loading}>
              {loading ? "Checking..." : "Log in"}
            </button>
          </form>

          <p className={styles.switch}>
            New to CampusLink? <Link href="/register">Create an account</Link>
          </p>
        </>
      ) : (
        <>
          <div className={styles.step}>
            <span className={styles.stepBadge}>STEP 2 OF 2</span>
            <span className={styles.stepBarFull} aria-hidden="true" />
          </div>
          <h1 className={styles.title}>Enter your verification code</h1>
          <p className={styles.subtitle}>
            For your security, we sent a 6-digit code to <strong>{cleanEmail}</strong>. Type it below to finish
            logging in. It can take up to a minute to arrive. Check your Junk folder if you can&apos;t find it.
          </p>

          {error && <p className={styles.serverError}>{error}</p>}

          <form onSubmit={handleCodeSubmit} noValidate>
            <OtpInput
              digits={digits}
              onChange={(d) => {
                setDigits(d);
                if (!isLocked) setError("");
              }}
              disabled={isLocked || isExpired || loading}
              hasError={Boolean(error)}
            />

            {isLocked ? (
              <p className={otpStyles.timerExpired}>Locked. Try again in {lockSecondsLeft}s.</p>
            ) : isExpired ? (
              <p className={otpStyles.timerExpired}>Code expired. Send a new code.</p>
            ) : (
              <p className={otpStyles.timer}>Code expires in {formatTime(codeSecondsLeft)}</p>
            )}

            <button
              type="submit"
              className={styles.submit}
              style={{ width: "100%", marginTop: "1.25rem" }}
              disabled={loading || isLocked || isExpired}
            >
              {loading ? "Verifying..." : "Verify and log in"}
            </button>
          </form>

          <div className={otpStyles.secondaryRow}>
            <button type="button" className={otpStyles.linkButton} onClick={backToPassword}>
              Use a different account
            </button>
            <button
              type="button"
              className={otpStyles.linkButton}
              onClick={handleResend}
              disabled={loading || resendSecondsLeft > 0}
            >
              {resendSecondsLeft > 0 ? `Send a new code (${resendSecondsLeft}s)` : "Send a new code"}
            </button>
          </div>
        </>
      )}
    </AuthLayout>
  );
}
