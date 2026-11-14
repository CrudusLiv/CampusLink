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
  if (!day && !time) return true;

  return availability.some((slot) => {
    if (day && slot.day !== day) return false;
    if (!time) return true;

    if (!day) return true;

    const minutes = (value: string) => {
      const [hours, mins] = value.slice(0, 5).split(":").map(Number);
      return hours * 60 + mins;
    };
    const requestedStart = minutes(time);
    return minutes(slot.start) <= requestedStart
      && requestedStart + SLOT_MINUTES <= minutes(slot.end);
  });
}
