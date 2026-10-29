"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getVolunteerRequestAction } from "@/lib/support-requests/volunteers";
import styles from "./volunteer-profile.module.css";

type Profile = {
  user_id: string;
  name: string;
  photo_url: string | null;
  faculty: string | null;
  bio: string | null;
};

type Slot = { day_of_week: string; start_time: string; end_time: string };
type RatingSummary = { average: number | null; count: number; recent: { rating: number; comment: string }[] };

export default function VolunteerProfile({ userId }: { userId: string }) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [skills, setSkills] = useState<string[]>([]);
  const [availability, setAvailability] = useState<Slot[]>([]);
  const [ratings, setRatings] = useState<RatingSummary | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [returnHref, setReturnHref] = useState("/volunteer-lists");

  useEffect(() => {
    const query = window.location.search;
    if (query) setReturnHref(`/volunteer-lists${query}`);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [{ data: authData }, { data: person, error: profileError }, { data: volunteer, error: volunteerError }, { data: slots, error: slotsError }, { data: summary }] =
        await Promise.all([
          supabase.auth.getUser(),
          supabase.from("users").select("user_id, name, photo_url, faculty, bio").eq("user_id", userId).maybeSingle(),
          supabase.from("volunteer_profile").select("skills, is_volunteer").eq("user_id", userId).maybeSingle(),
          supabase.from("availability").select("day_of_week, start_time, end_time").eq("user_id", userId),
          supabase.rpc("volunteer_rating_summary", { p_volunteer_id: userId }),
        ]);

      if (cancelled) return;
      setCurrentUserId(authData.user?.id ?? null);
      if (profileError || volunteerError || slotsError || !person || !volunteer?.is_volunteer) {
        setError("This volunteer profile is unavailable.");
      } else {
        setProfile(person as Profile);
        setSkills(volunteer.skills ?? []);
        setAvailability(slots ?? []);
        setRatings((summary ?? null) as RatingSummary | null);
      }
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [userId]);

  const weeklyAvailability = useMemo(() => {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return days.flatMap((day) => {
      const slots = availability.filter((slot) => slot.day_of_week === day);
      return slots.length ? [`${day}: ${slots.map((slot) => `${slot.start_time.slice(0, 5)}–${slot.end_time.slice(0, 5)}`).join(", ")}`] : [];
    });
  }, [availability]);
  const requestAction = getVolunteerRequestAction(userId, currentUserId);

  function handleMakeRequest() {
    if (!profile) return;
    const params = new URLSearchParams(window.location.search);
    const requestedSkill = params.get("skill");
    const category = requestedSkill && skills.includes(requestedSkill) ? requestedSkill : skills[0] ?? requestedSkill ?? "";
    params.set("volunteerId", profile.user_id);
    params.set("volunteerName", profile.name);
    if (profile.photo_url) params.set("volunteerPhoto", profile.photo_url);
    if (category) params.set("category", category);
    router.push(`/sessions/ask-for-support?${params.toString()}`);
  }

  if (loading) return <main className={styles.content}><p className={styles.message}>Loading volunteer profile…</p></main>;
  if (error || !profile) return <main className={styles.content}><div className={styles.message} role="alert">{error || "This volunteer profile is unavailable."}</div><Link href={returnHref} className={styles.backLink}>Back to Volunteer Lists</Link></main>;

  return (
    <main className={styles.content}>
      <p><Link href={returnHref} className={styles.backLink}>← Volunteer Lists</Link></p>
      <div className={styles.profileGrid}>
        <section className={styles.mainColumn}>
          <div className={styles.identity}>
            {profile.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.photo} src={profile.photo_url} alt={`${profile.name}'s profile`} />
            ) : <div className={styles.photoFallback}>{profile.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</div>}
            <div className={styles.namePanel}>
              <h2>{profile.name}</h2>
              {profile.faculty && <p>{profile.faculty}</p>}
              {profile.bio && <p>{profile.bio}</p>}
            </div>
          </div>

          <section className={styles.section}>
            <h2>Skills</h2>
            {skills.length ? <div className={styles.skills}>{skills.map((skill) => <span key={skill} className={styles.skill}>{skill}</span>)}</div> : <p className={styles.muted}>No skills listed.</p>}
          </section>

          <section className={styles.section}>
            <h2>Ratings and feedback</h2>
            {ratings && ratings.count > 0 ? (
              <div className={styles.feedbackBox}>
                <p className={styles.ratingSummary}>
                  <span className={styles.ratingStars} role="img" aria-label={`Average rating ${ratings.average} out of 5`}>★</span>
                  <strong>{ratings.average}</strong> out of 5 · {ratings.count} {ratings.count === 1 ? "rating" : "ratings"}
                </p>
                {ratings.recent.length > 0 && (
                  <ul className={styles.feedbackList}>
                    {ratings.recent.map((item, index) => (
                      <li key={index}>
                        <span className={styles.ratingStars} role="img" aria-label={`${item.rating} out of 5 stars`}>{"★".repeat(item.rating)}{"☆".repeat(5 - item.rating)}</span>
                        <p>{item.comment}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : <div className={styles.emptyFeedback}>No feedback yet.</div>}
          </section>
        </section>

        <aside className={styles.availabilityPanel}>
          <h2>Availability</h2>
          {weeklyAvailability.length ? <ul>{weeklyAvailability.map((item) => <li key={item}>{item}</li>)}</ul> : <p className={styles.muted}>Weekly availability hasn&apos;t been added.</p>}
          <button type="button" className={`${styles.requestButton} ${requestAction.disabled ? styles.requestButtonDisabled : ""}`} disabled={requestAction.disabled} onClick={handleMakeRequest}>Make a Request</button>
          {requestAction.message && <p className={styles.selfRequestError} role="alert">{requestAction.message}</p>}
        </aside>
      </div>
    </main>
  );
}
