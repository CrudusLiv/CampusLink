import { describe, expect, it } from "vitest";
import { isOwnVolunteer, volunteerDirectoryCards, withoutOwnVolunteer } from "@/lib/support-requests/volunteers";

const SELF = "a1b2c3d4-0001-4000-8000-000000000001";
const OTHER = "a1b2c3d4-0002-4000-8000-000000000002";

describe("volunteer self-selection", () => {
  it("keeps the current user's card in the directory while disabling its request action", () => {
    const cards = volunteerDirectoryCards([{ user_id: SELF }, { user_id: OTHER }], SELF);
    expect(cards.map(({ volunteer }) => volunteer.user_id)).toContain(SELF);
    expect(cards.find(({ volunteer }) => volunteer.user_id === SELF)?.requestAction).toEqual({
      disabled: true, message: "You cannot select yourself as a volunteer.",
    });
  });

  it("leaves another volunteer's request action enabled", () => {
    expect(volunteerDirectoryCards([{ user_id: OTHER }], SELF)[0].requestAction).toEqual({ disabled: false, message: null });
    expect(isOwnVolunteer(OTHER, SELF)).toBe(false);
  });

  it("excludes only the current user from Auto-Match candidates", () => {
    const candidates = [{ user_id: SELF }, { user_id: OTHER }];
    expect(withoutOwnVolunteer(candidates, SELF)).toEqual([{ user_id: OTHER }]);
    expect(withoutOwnVolunteer(candidates, null)).toEqual(candidates);
  });

  it("identifies a self-selection by stable user ID", () => {
    expect(isOwnVolunteer(SELF, SELF)).toBe(true);
    expect(isOwnVolunteer(null, SELF)).toBe(false);
  });
});
