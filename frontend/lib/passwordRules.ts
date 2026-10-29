// The password rule from User Story 8 (also used at registration):
// at least 8 characters, 1 uppercase letter and 1 number.
// Shown as a live checklist under the password field.

export function passwordRules(password: string) {
  return [
    { ok: password.length >= 8, text: "At least 8 characters" },
    { ok: /[A-Z]/.test(password), text: "1 uppercase letter" },
    { ok: /\d/.test(password), text: "1 number" },
  ];
}
