// Shared lists used across CampusLink.
// IMPORTANT: volunteer skills (Epic 1) and support request categories (Epic 2)
// must use the SAME names, otherwise filtering and auto-matching won't find matches.
// To add a new subject, add it here only.

export const SUBJECTS = [
  "Programming",
  "Database",
  "Mathematics",
  "Writing & Reports",
  "IT Help",
  "Campus Orientation",
] as const;

export type Subject = (typeof SUBJECTS)[number];

// Must match the day_of_week enum in Supabase
export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export type Day = (typeof DAYS)[number];
