// Unit tests – My Profile form rules (User Story 5)
import { describe, expect, it } from "vitest";
import { BIO_MAX, validateProfile, type ProfileForm } from "../../lib/validation/profile";

const valid: ProfileForm = {
  name: "Doreen Tang",
  phone: "012-345 6789",
  faculty: "Faculty of Computing and Digital Technology",
  bio: "Happy to help with programming.",
};

describe("validateProfile", () => {
  it("UT-E1-15 returns no errors for a valid profile", () => {
    expect(validateProfile(valid)).toEqual({});
  });

  it("UT-E1-16 accepts empty optional fields (phone, faculty, bio)", () => {
    expect(validateProfile({ name: "Doreen Tang", phone: "", faculty: "", bio: "" })).toEqual({});
  });

  it("UT-E1-17 rejects a name shorter than 2 characters", () => {
    expect(validateProfile({ ...valid, name: "D" }).name).toBeDefined();
  });

  it("UT-E1-18 rejects a name longer than 100 characters", () => {
    expect(validateProfile({ ...valid, name: "a".repeat(101) }).name).toBeDefined();
  });

  it("UT-E1-19 rejects an invalid phone number", () => {
    expect(validateProfile({ ...valid, phone: "12" }).phone).toBeDefined();
  });

  it("UT-E1-20 accepts a bio of exactly the maximum length (boundary)", () => {
    expect(validateProfile({ ...valid, bio: "a".repeat(BIO_MAX) }).bio).toBeUndefined();
  });

  it("UT-E1-21 rejects a bio over the maximum length", () => {
    expect(validateProfile({ ...valid, bio: "a".repeat(BIO_MAX + 1) }).bio).toBeDefined();
  });
});
