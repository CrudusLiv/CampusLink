"use client";

// Six separate boxes for the 6-digit login code (Epic 1 – User Story 1).
// Typing a digit jumps to the next box, Backspace on an empty box jumps back,
// and pasting a whole code fills every box. Only digits are accepted.

import { useRef, KeyboardEvent, ClipboardEvent } from "react";
import styles from "./OtpInput.module.css";

type Props = {
  digits: string[]; // always 6 items, "" for an empty box
  onChange: (digits: string[]) => void;
  disabled?: boolean;
  hasError?: boolean;
};

export default function OtpInput({ digits, onChange, disabled, hasError }: Props) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  function setDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1); // keep the last digit typed
    const next = [...digits];
    next[index] = digit;
    onChange(next);
    if (digit && index < 5) boxes.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      boxes.current[index - 1]?.focus();
    }
    if (event.key === "ArrowLeft" && index > 0) boxes.current[index - 1]?.focus();
    if (event.key === "ArrowRight" && index < 5) boxes.current[index + 1]?.focus();
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    event.preventDefault();
    const next = Array.from({ length: 6 }, (_, i) => pasted[i] ?? "");
    onChange(next);
    boxes.current[Math.min(pasted.length, 5)]?.focus();
  }

  return (
    <div className={styles.row}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            boxes.current[index] = el;
          }}
          value={digit}
          onChange={(e) => setDigit(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={2}
          disabled={disabled}
          autoFocus={index === 0}
          aria-label={`Digit ${index + 1} of 6`}
          className={hasError ? `${styles.cell} ${styles.cellError}` : styles.cell}
        />
      ))}
    </div>
  );
}
