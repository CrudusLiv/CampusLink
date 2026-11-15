"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getVolunteerRequestAction, volunteerDirectoryCards, withoutOwnVolunteer } from "@/lib/support-requests/volunteers";
import styles from "./volunteer-lists.module.css";
import { matchesVolunteerSearch, matchesVolunteerSkillAndFaculty, matchesWeeklyAvailability } from "@/lib/support-requests/volunteer-search";
import { loadVolunteerDirectory, type VolunteerDirectoryEntry, } from "@/lib/support-requests/volunteer-directory";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function weekdayFromDate(date: string) {
  if (!date) return "";
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? "" : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][parsed.getDay()];
}

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");

export default function VolunteerDirectory() {
  const router = useRouter();
  const [volunteers, setVolunteers] = useState<VolunteerDirectoryEntry[]>([]);
  const [search, setSearch] = useState("");
  const [skill, setSkill] = useState("");
  const [faculty, setFaculty] = useState("");
  const [day, setDay] = useState("");
  const [time, setTime] = useState("");
  const [requestDate, setRequestDate] = useState("");
  const [supportMode, setSupportMode] = useState("");
  const [selectedVolunteerId, setSelectedVolunteerId] = useState("");
  const [fromAskForSupport, setFromAskForSupport] = useState(false);
  const [changeRequestId, setChangeRequestId] = useState<string | null>(null);
  const [excludedVolunteerId, setExcludedVolunteerId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const changeVolunteerMode = changeRequestId !== null;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setFromAskForSupport(params.get("from") === "ask-for-support");
    const requestId = params.get("requestId");
    if (params.get("from") === "change-volunteer" && requestId && UUID_PATTERN.test(requestId)) {
      setChangeRequestId(requestId);
      setExcludedVolunteerId(params.get("excludeVolunteerId"));
      setSelectedVolunteerId(params.get("excludeVolunteerId") ?? "");
    }
    const date = params.get("date") ?? "";
    setSearch(params.get("search") ?? "");
    setSkill(params.get("skill") ?? "");
    setFaculty(params.get("faculty") ?? "");
    setDay(params.get("day") || weekdayFromDate(date));
    setTime(params.get("time") ?? "");
    setRequestDate(date);
    setSupportMode(params.get("supportMode") ?? params.get("mode") ?? "");
    if (!(params.get("from") === "change-volunteer" && requestId && UUID_PATTERN.test(requestId))) {
      setSelectedVolunteerId(params.get("selectedVolunteer") ?? "");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadVolunteers() {
      setLoading(true);
      setError("");

      const result = await loadVolunteerDirectory(supabase);

      if (cancelled) return;

      setCurrentUserId(result.currentUserId);

      if (result.error === "volunteer-list") {
        setError("We couldn't load the volunteer list. Please try again later.");
        setLoading(false);
        return;
      }

      if (result.error === "volunteer-details") {
        setError("We couldn't load volunteer details. Please try again later.");
        setLoading(false);
        return;
      }

      setVolunteers(result.volunteers);
      setLoading(false);
    }

    loadVolunteers();

    return () => {
      cancelled = true;
    };
  }, []);

  const skills = useMemo(() => [...new Set(volunteers.flatMap((volunteer) => volunteer.skills))].sort(), [volunteers]);
  const faculties = useMemo(
    () => [...new Set(volunteers.map((volunteer) => volunteer.faculty).filter((value): value is string => Boolean(value)))].sort(),
    [volunteers],
  );
  const days = useMemo(() => [...new Set(volunteers.flatMap((volunteer) => volunteer.availability.map((slot) => slot.day)))], [volunteers]);
  const timeSlotLabel = useMemo(() => {
    if (!time) return "";
    const [hours, minutes] = time.split(":").map(Number);
    const start = hours * 60 + minutes;
    const format = (totalMinutes: number) => {
      const normalized = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
      const hour = Math.floor(normalized / 60);
      const twelveHour = hour % 12 || 12;
      const period = hour < 12 ? "AM" : "PM";
      return `${twelveHour}:${String(normalized % 60).padStart(2, "0")} ${period}`;
    };
    return `${format(start)} - ${format(start + 60)}`;
  }, [time]);

  const otherVolunteers = withoutOwnVolunteer(volunteers.filter((volunteer) => volunteer.user_id !== excludedVolunteerId), currentUserId);
  const filtered = otherVolunteers.filter((volunteer) => {
    const matchesSearch = matchesVolunteerSearch(volunteer, search);

    return matchesSearch && matchesVolunteerSkillAndFaculty(volunteer, skill, faculty) && matchesWeeklyAvailability(volunteer.availability, day, time);
  });

  const visibleVolunteerCards = volunteerDirectoryCards(filtered, currentUserId);

  function requestUrl(volunteer: VolunteerDirectoryEntry) {
    const params = new URLSearchParams();
    const category = volunteer.skills.includes(skill) ? skill : volunteer.skills[0] ?? skill;
    params.set("volunteerId", volunteer.user_id);
    params.set("volunteerName", volunteer.name);
    if (volunteer.photo_url) params.set("volunteerPhoto", volunteer.photo_url);
    if (category) params.set("category", category);
    if (requestDate) params.set("date", requestDate);
    if (time) params.set("time", time);
    if (supportMode) params.set("mode", supportMode);
    if (changeRequestId) {
      params.set("volunteerId", volunteer.user_id);
      params.set("volunteerName", volunteer.name);
      if (volunteer.photo_url) params.set("volunteerPhoto", volunteer.photo_url);
      if (category) params.set("category", category);
      params.set("from", "change-volunteer");
      return `/support-requests/${changeRequestId}?${new URLSearchParams({ ...Object.fromEntries(params), mode: "change-volunteer" }).toString()}`;
    }
    params.set("from", "volunteer-lists");
    return `/sessions/ask-for-support?${params.toString()}`;
  }

  function profileUrl(volunteer: VolunteerDirectoryEntry) {
    const params = new URLSearchParams();
    if (skill) params.set("skill", skill);
    if (requestDate) params.set("date", requestDate);
    if (time) params.set("time", time);
    if (supportMode) params.set("mode", supportMode);
    if (search) params.set("search", search);
    if (faculty) params.set("faculty", faculty);
    if (day) params.set("day", day);
    params.set("selectedVolunteer", volunteer.user_id);
    if (changeRequestId) {
      params.set("requestId", changeRequestId);
      params.set("from", "change-volunteer");
      if (excludedVolunteerId) params.set("excludeVolunteerId", excludedVolunteerId);
    }
    const query = params.toString();
    return `/volunteer-lists/${volunteer.user_id}${query ? `?${query}` : ""}`;
  }

  return (
    <main className={styles.content}>
      <p className={styles.backRow}><Link href={changeVolunteerMode ? `/support-requests/${changeRequestId}?mode=change-volunteer` : fromAskForSupport ? "/sessions/ask-for-support" : "/dashboard"} className={styles.backLink}>{changeVolunteerMode ? "← Back to Change Volunteer" : fromAskForSupport ? "← Back to Ask For Support" : "← Back to Dashboard"}</Link></p>
      <div className={styles.toolbar}>
        <label className={styles.searchLabel}>
          <span className={styles.srOnly}>Search volunteers</span>
          <input className={styles.search} type="search" placeholder="Search volunteers" value={search} disabled={changeVolunteerMode} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <div className={styles.filters}>
          <label className={styles.filterLabel}>Skills
            <select value={skill} disabled={changeVolunteerMode} onChange={(event) => setSkill(event.target.value)}>
              <option value="">All skills</option>
              {skill && !skills.includes(skill) && <option value={skill}>{skill}</option>}
              {skills.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className={styles.filterLabel}>Faculty
            <select value={faculty} disabled={changeVolunteerMode} onChange={(event) => setFaculty(event.target.value)}>
              <option value="">All faculties</option>
              {faculties.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <div className={styles.availabilityFilters}>
            <label className={styles.filterLabel}>Weekly availability
              <select value={day} disabled={changeVolunteerMode} onChange={(event) => setDay(event.target.value)}>
                <option value="">Any day</option>
                {day && !days.includes(day) && <option value={day}>{day}</option>}
                {days.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className={styles.filterLabel}>Time
              <input
                type="time"
                value={time}
                disabled={changeVolunteerMode}
                onChange={(event) => setTime(event.target.value)}
                aria-label="Filter volunteers by availability time"
              />
              {timeSlotLabel && <span className={styles.timeSlot} aria-live="polite">Time Slot: {timeSlotLabel}</span>}
            </label>
          </div>
        </div>
      </div>

      <div className={styles.resultLine} aria-live="polite">
        {loading ? "Loading volunteers…" : error ? "" : `${filtered.length} volunteer${filtered.length === 1 ? "" : "s"}`}
      </div>

      {error ? <div className={styles.message} role="alert">{error}</div> : loading ? (
        <div className={styles.message}>Loading the volunteer directory…</div>
      ) : filtered.length === 0 ? (
        <div className={styles.message}>
          <h2>{otherVolunteers.length ? "No volunteers match those filters" : volunteers.length ? "No other volunteers yet" : "No volunteers yet"}</h2>
          <p>{otherVolunteers.length ? "Try changing your search or filters." : volunteers.length ? "Other volunteers will appear here once they finish setting up their profile." : "Volunteers will appear here once they finish setting up their profile."}</p>
        </div>
      ) : (
        <ul className={styles.grid}>
          {visibleVolunteerCards.map(({ volunteer }) => (
            <li className={styles.cardItem} key={volunteer.user_id}>
              <div
                className={`${styles.card} ${selectedVolunteerId === volunteer.user_id ? styles.cardSelected : ""}`}
                role="button"
                tabIndex={0}
                aria-pressed={selectedVolunteerId === volunteer.user_id}
                onClick={() => setSelectedVolunteerId((currentId) => currentId === volunteer.user_id ? "" : volunteer.user_id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedVolunteerId((currentId) => currentId === volunteer.user_id ? "" : volunteer.user_id);
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
              </div>
              {selectedVolunteerId === volunteer.user_id && (() => {
                const action = getVolunteerRequestAction(volunteer.user_id, currentUserId);
                return <aside className={styles.cardActions} aria-label={`${volunteer.name} actions`}>
                  <div className={styles.selectionActions}>
                    <div className={styles.requestActionGroup}>
                      <button type="button" className={`${styles.primaryAction} ${action.disabled ? styles.disabledAction : ""}`} disabled={action.disabled} onClick={() => router.push(requestUrl(volunteer))}>{changeRequestId ? "Choose Volunteer" : "Make a Request"}</button>
                      {action.message && <p className={styles.selfRequestError} role="alert">{action.message}</p>}
                    </div>
                    <button type="button" className={styles.secondaryAction} onClick={() => router.push(profileUrl(volunteer))}>View volunteer profile</button>
                  </div>
                </aside>;
              })()}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
