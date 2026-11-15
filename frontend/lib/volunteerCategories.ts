// The four volunteer categories from Use Case 1 (Become a Volunteer, line 3b)
// and the preferred support mode. Epic 1 only: the subject names themselves
// still come from lib/categories.ts, so support request matching (Epic 2)
// is not affected.

export const VOLUNTEER_CATEGORIES = [
  {
    name: "Academic Support",
    examples: "Mathematics, programming, study techniques, assignment guidance",
    subjects: ["Programming", "Database", "Mathematics", "Writing & Reports"],
  },
  {
    name: "Technology Support",
    examples: "Software installation, basic computer support, productivity tools",
    subjects: ["IT Help"],
  },
  {
    name: "New Student Support",
    examples: "Campus orientation, navigating university facilities, student life guidance",
    subjects: ["Campus Orientation"],
  },
  {
    name: "General Student Support",
    examples: "General non-academic assistance and peer guidance",
    subjects: [] as string[],
  },
] as const;

export type VolunteerCategory = (typeof VOLUNTEER_CATEGORIES)[number]["name"];

// Which category a subject belongs to. Subjects the volunteer typed in themselves
// are not in any list, so they are shown under General Student Support.
export function categoryOf(subject: string): VolunteerCategory {
  const found = VOLUNTEER_CATEGORIES.find((c) => (c.subjects as readonly string[]).includes(subject));
  return found ? found.name : "General Student Support";
}

// Values match the ones used by support requests and sessions (Epic 2 / Epic 3).
// "Online" = Virtual and "In-person" = F2F in the use case.
export const SUPPORT_MODES = [
  { value: "Online", label: "Online" },
  { value: "In-person", label: "In-person" },
  { value: "Both", label: "Both" },
] as const;

export type SupportMode = (typeof SUPPORT_MODES)[number]["value"];
