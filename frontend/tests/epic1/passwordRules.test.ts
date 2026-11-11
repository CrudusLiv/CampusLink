// Unit tests – password rules shared by Register (US9) and Reset Password (US8)
import { describe, expect, it } from "vitest";
import { passwordRules } from "../../lib/passwordRules";

const allPassed = (password: string) => passwordRules(password).every((rule) => rule.ok);

describe("passwordRules", () => {
  it("UT-E1-01 accepts a password with 8+ characters, 1 uppercase and 1 number", () => {
    expect(allPassed("Campus2026")).toBe(true);
  });

  it("UT-E1-02 rejects a password shorter than 8 characters", () => {
    const rules = passwordRules("Abc1234");
    expect(rules[0].ok).toBe(false);
  });

  it("UT-E1-03 rejects a password with no uppercase letter", () => {
    expect(passwordRules("campus2026")[1].ok).toBe(false);
  });

  it("UT-E1-04 rejects a password with no number", () => {
    expect(passwordRules("CampusLink")[2].ok).toBe(false);
  });

  it("UT-E1-05 accepts exactly 8 characters (boundary)", () => {
    expect(allPassed("Abcdefg1")).toBe(true);
  });
});
