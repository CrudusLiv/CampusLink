// My Profile form rules (Epic 1 – User Story 5).
// Kept outside the page so the rules can be unit tested with Vitest.

export type ProfileForm = {
  name: string;
  phone: string;
  faculty: string;
  bio: string;
};

export type ProfileErrors = Partial<Record<keyof ProfileForm, string>>;

export const BIO_MAX = 300;

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
