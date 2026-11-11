// Unit tests – registration form rules (FR1 / User Story 9)
import { describe, expect, it } from "vitest";
import { validateRegistration, type RegistrationData } from "../../lib/validation/registration";

const valid: RegistrationData = {
  fullName: "Doreen Tang",
  studentId: "B2400089",
  email: "b2400089@helplive.edu.my",
  phone: "",
  password: "Campus2026",
  confirmPassword: "Campus2026",
};

describe("validateRegistration", () => {
  it("UT-E1-06 returns no errors for a valid form", () => {
    expect(validateRegistration(valid)).toEqual({});
  });

  it("UT-E1-07 accepts an optional phone number in a valid format", () => {
    expect(validateRegistration({ ...valid, phone: "012-345 6789" })).toEqual({});
  });

  it("UT-E1-08 rejects an empty full name", () => {
    expect(validateRegistration({ ...valid, fullName: " " }).fullName).toBeDefined();
  });

  it("UT-E1-09 rejects a student ID in the wrong format", () => {
    expect(validateRegistration({ ...valid, studentId: "2400089" }).studentId).toBeDefined();
    expect(validateRegistration({ ...valid, studentId: "B24000" }).studentId).toBeDefined();
  });

  it("UT-E1-10 rejects an email that is not a university email", () => {
    expect(validateRegistration({ ...valid, email: "doreen@gmail.com" }).email).toBeDefined();
  });

  it("UT-E1-11 accepts a university email typed in capital letters", () => {
    expect(validateRegistration({ ...valid, email: "B2400089@HELPLIVE.EDU.MY" }).email).toBeUndefined();
  });

  it("UT-E1-12 rejects a phone number with letters", () => {
    expect(validateRegistration({ ...valid, phone: "012-ABC 6789" }).phone).toBeDefined();
  });

  it("UT-E1-13 rejects a weak password", () => {
    const weak = { ...valid, password: "campus", confirmPassword: "campus" };
    expect(validateRegistration(weak).password).toBeDefined();
  });

  it("UT-E1-14 rejects passwords that do not match", () => {
    expect(validateRegistration({ ...valid, confirmPassword: "Campus2027" }).confirmPassword).toBe(
      "Passwords do not match."
    );
  });
});
