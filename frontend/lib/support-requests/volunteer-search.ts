import { SLOT_MINUTES } from "@/lib/sessions/slots";

type SearchableVolunteer = {
  name: string;
  faculty: string | null;
  skills: string[];
};

export function matchesVolunteerSearch(
  volunteer: SearchableVolunteer,
  search: string,
) {
  const query = search.trim().toLowerCase();

  return (
    !query ||
    volunteer.name.toLowerCase().includes(query) ||
    (volunteer.faculty ?? "").toLowerCase().includes(query) ||
    volunteer.skills.some((skill) => skill.toLowerCase().includes(query))
  );
}

type SkillFacultyVolunteer = {
  skills: string[];
  faculty: string | null;
};

export function matchesVolunteerSkillAndFaculty(
  volunteer: SkillFacultyVolunteer,
  skill: string,
  faculty: string,
) {
  return (
    (!skill || volunteer.skills.includes(skill)) &&
    (!faculty || volunteer.faculty === faculty)
  );
}

type WeeklyAvailability = {
  day: string;
  start: string;
  end: string;
};

export function matchesWeeklyAvailability(
  availability: WeeklyAvailability[],
  day: string,
  time: string,
) {
  if (!day) return true;

  return availability.some((slot) => {
    if (slot.day !== day) return false;
    if (!time) return true;

    const selected = time.slice(0, 5);
    return slot.start.slice(0, 5) <= selected && selected < slot.end.slice(0, 5);
  });
}
