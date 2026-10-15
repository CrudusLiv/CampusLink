"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import styles from "./volunteer-lists.module.css";

type Volunteer = {
  user_id: string;
  name: string;
  photo_url: string | null;
  faculty: string | null;
  skills: string[];
  availability: { day: string; start: string; end: string }[];
};

function weekdayFromDate(date: string) {
  if (!date) return "";
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? "" : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][parsed.getDay()];
}

function timeIsInRange(time: string, start: string, end: string) {
  if (!time) return true;
  const selected = time.slice(0, 5);
  return start.slice(0, 5) <= selected && selected < end.slice(0, 5);
}

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");

export default function VolunteerDirectory() {
  const router = useRouter();
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [search, setSearch] = useState("");
  const [skill, setSkill] = useState("");
  const [faculty, setFaculty] = useState("");
  const [day, setDay] = useState("");
  const [time, setTime] = useState("");
  const [requestDate, setRequestDate] = useState("");
  const [supportMode, setSupportMode] = useState("");
  const [selectedVolunteerId, setSelectedVolunteerId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const date = params.get("date") ?? "";
    setSearch(params.get("search") ?? "");
    setSkill(params.get("skill") ?? "");
    setFaculty(params.get("faculty") ?? "");
    setDay(params.get("day") || weekdayFromDate(date));
    setTime(params.get("time") ?? "");
    setRequestDate(date);
    setSupportMode(params.get("mode") ?? "");
    setSelectedVolunteerId(params.get("selectedVolunteer") ?? "");
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadVolunteers() {
      setLoading(true);
      setError("");

      const { data: volunteerRows, error: volunteerError } = await supabase
        .from("volunteer_profile")
        .select("user_id, skills")
        .eq("is_volunteer", true);

      if (volunteerError) {
        if (!cancelled) setError("We couldn't load the volunteer list. Please try again later.");
        if (!cancelled) setLoading(false);
        return;
      }

      const rows = volunteerRows ?? [];
      if (rows.length === 0) {
        if (!cancelled) {
          setVolunteers([]);
          setLoading(false);
        }
        return;
      }

      const ids = rows.map((row) => row.user_id);
      const [{ data: profiles, error: profileError }, { data: availability, error: availabilityError }] =
        await Promise.all([
          supabase.from("users").select("user_id, name, photo_url, faculty").in("user_id", ids),
          supabase.from("availability").select("user_id, day_of_week, start_time, end_time").in("user_id", ids),
        ]);

      if (profileError || availabilityError) {
        if (!cancelled) setError("We couldn't load volunteer details. Please try again later.");
        if (!cancelled) setLoading(false);
        return;
      }

      const profileById = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]));
      const availabilityById = new Map<string, Volunteer["availability"]>();
      (availability ?? []).forEach((slot) => {
        const slots = availabilityById.get(slot.user_id) ?? [];
        slots.push({ day: slot.day_of_week, start: slot.start_time, end: slot.end_time });
        availabilityById.set(slot.user_id, slots);
      });

      const result = rows.flatMap((row) => {
        const profile = profileById.get(row.user_id);
        if (!profile) return [];
        return [{
          user_id: row.user_id,
          name: profile.name,
          photo_url: profile.photo_url,
          faculty: profile.faculty,
          skills: row.skills ?? [],
          availability: availabilityById.get(row.user_id) ?? [],
        }];
      });

      if (!cancelled) {
        setVolunteers(result);
        setLoading(false);
      }
    }

    loadVolunteers();
    return () => { cancelled = true; };
  }, []);

  const skills = useMemo(() => [...new Set(volunteers.flatMap((volunteer) => volunteer.skills))].sort(), [volunteers]);
  const faculties = useMemo(
    () => [...new Set(volunteers.map((volunteer) => volunteer.faculty).filter((value): value is string => Boolean(value)))].sort(),
    [volunteers],
  );
  const days = useMemo(() => [...new Set(volunteers.flatMap((volunteer) => volunteer.availability.map((slot) => slot.day)))], [volunteers]);

  const filtered = volunteers.filter((volunteer) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || volunteer.name.toLowerCase().includes(query) ||
      (volunteer.faculty ?? "").toLowerCase().includes(query) ||
      volunteer.skills.some((item) => item.toLowerCase().includes(query));
    return matchesSearch && (!skill || volunteer.skills.includes(skill)) &&
      (!faculty || volunteer.faculty === faculty) && (!day || volunteer.availability.some((slot) =>
        slot.day === day && timeIsInRange(time, slot.start, slot.end)
      ));
  });

  const selectedVolunteer = volunteers.find((volunteer) => volunteer.user_id === selectedVolunteerId);

  function requestUrl(volunteer: Volunteer) {
    const params = new URLSearchParams();
    const category = volunteer.skills.includes(skill) ? skill : volunteer.skills[0] ?? skill;
    params.set("volunteerId", volunteer.user_id);
    params.set("volunteerName", volunteer.name);
    if (volunteer.photo_url) params.set("volunteerPhoto", volunteer.photo_url);
    if (category) params.set("category", category);
    if (requestDate) params.set("date", requestDate);
    if (time) params.set("time", time);
    if (supportMode) params.set("mode", supportMode);
    return `/sessions/ask-for-support?${params.toString()}`;
  }

  function profileUrl(volunteer: Volunteer) {
    const params = new URLSearchParams();
    if (skill) params.set("skill", skill);
    if (requestDate) params.set("date", requestDate);
    if (time) params.set("time", time);
    if (supportMode) params.set("mode", supportMode);
    if (search) params.set("search", search);
    if (faculty) params.set("faculty", faculty);
    if (day) params.set("day", day);
    params.set("selectedVolunteer", volunteer.user_id);
    const query = params.toString();
    return `/volunteer-lists/${volunteer.user_id}${query ? `?${query}` : ""}`;
  }

  return (
    <main className={styles.content}>
      <p className={styles.backRow}><Link href="/sessions/ask-for-support" className={styles.backLink}>← Back to Ask For Support</Link></p>
      <div className={styles.toolbar}>
        <label className={styles.searchLabel}>
          <span className={styles.srOnly}>Search volunteers</span>
          <input className={styles.search} type="search" placeholder="Search volunteers" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <div className={styles.filters}>
          <label className={styles.filterLabel}>Skills
            <select value={skill} onChange={(event) => setSkill(event.target.value)}>
              <option value="">All skills</option>
              {skill && !skills.includes(skill) && <option value={skill}>{skill}</option>}
              {skills.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className={styles.filterLabel}>Faculty
            <select value={faculty} onChange={(event) => setFaculty(event.target.value)}>
              <option value="">All faculties</option>
              {faculties.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className={styles.filterLabel}>Weekly availability
            <select value={day} onChange={(event) => setDay(event.target.value)}>
              <option value="">Any day</option>
              {day && !days.includes(day) && <option value={day}>{day}</option>}
              {days.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>
        {(requestDate || supportMode) && <p className={styles.requestPreference}>
          Matching request{requestDate ? ` for ${requestDate}` : ""}{time ? ` at ${time}` : ""}{supportMode ? ` · ${supportMode}` : ""}
        </p>}
      </div>

      <div className={styles.resultLine} aria-live="polite">
        {loading ? "Loading volunteers…" : error ? "" : `${filtered.length} volunteer${filtered.length === 1 ? "" : "s"}`}
      </div>

      {error ? <div className={styles.message} role="alert">{error}</div> : loading ? (
        <div className={styles.message}>Loading the volunteer directory…</div>
      ) : filtered.length === 0 ? (
        <div className={styles.message}>
          <h2>{volunteers.length ? "No volunteers match those filters" : "No volunteers yet"}</h2>
          <p>{volunteers.length ? "Try changing your search or filters." : "Volunteers will appear here once they finish setting up their profile."}</p>
        </div>
      ) : (
        <ul className={styles.grid}>
          {filtered.map((volunteer) => (
            <li
              className={`${styles.card} ${selectedVolunteerId === volunteer.user_id ? styles.cardSelected : ""}`}
              key={volunteer.user_id}
              role="button"
              tabIndex={0}
              aria-pressed={selectedVolunteerId === volunteer.user_id}
              onClick={() => setSelectedVolunteerId(volunteer.user_id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedVolunteerId(volunteer.user_id);
                }
              }}
            >
              {volunteer.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className={styles.avatar} src={volunteer.photo_url} alt={`${volunteer.name}'s profile`} />
              ) : (
                <span className={styles.avatarFallback} aria-label={`${volunteer.name}'s initials`}>{initials(volunteer.name)}</span>
              )}
              <h2 className={styles.name}>{volunteer.name}</h2>
              {volunteer.faculty && <p className={styles.faculty}>{volunteer.faculty}</p>}
              <div className={styles.skills} aria-label="Skills">
                {volunteer.skills.length ? volunteer.skills.map((item) => <span className={styles.skill} key={item}>{item}</span>) : <span className={styles.muted}>Skills not set</span>}
              </div>
              {volunteer.availability.length > 0 && <p className={styles.availability}>Available: {[...new Set(volunteer.availability.map((slot) => slot.day))].join(", ")}</p>}
            </li>
          ))}
        </ul>
      )}

      {selectedVolunteer && <aside className={styles.selectionBar} aria-label="Selected volunteer actions">
        <p className={styles.selectionName}>Selected: <strong>{selectedVolunteer.name}</strong></p>
        <div className={styles.selectionActions}>
          <button type="button" className={styles.primaryAction} onClick={() => router.push(requestUrl(selectedVolunteer))}>Make a request</button>
          <button type="button" className={styles.secondaryAction} onClick={() => router.push(profileUrl(selectedVolunteer))}>View volunteer profile</button>
        </div>
      </aside>}
    </main>
  );
}
