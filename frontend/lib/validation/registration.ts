// Registration form rules (Epic 1 – FR1 / User Story 9).
// Kept outside the page so the rules can be unit tested with Vitest.

export type RegistrationData = {
  fullName: string;
  studentId: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
};

// One error message per field (missing = no error)
export type RegistrationErrors = Partial<Record<keyof RegistrationData, string>>;

export const UNIVERSITY_DOMAIN = "@helplive.edu.my";

// Checks every field and returns the error messages.
export function validateRegistration(data: RegistrationData): RegistrationErrors {
  const errors: RegistrationErrors = {};

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
  if (data.password.length < 8 || !/[A-Z]/.test(data.password) || !/\d/.test(data.password)) {
    errors.password = "Password needs at least 8 characters, 1 uppercase letter and 1 number.";
  }

  if (data.confirmPassword !== data.password) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return errors;
}
