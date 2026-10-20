"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SUBJECTS } from "@/lib/categories";
import { ASK_SUPPORT_DRAFT_KEY } from "@/lib/askSupportDraft";
import { supabase } from "@/lib/supabaseClient";
import { isOwnVolunteer, isSelfVolunteerConstraintError, withoutOwnVolunteer } from "@/lib/support-requests/volunteers";
import styles from "./SubmitRequestForm.module.css";
import { matchesVolunteerSkill, selectVolunteerRecommendations, } from "@/lib/support-requests/volunteer-matching";

type AutoMatchVolunteer = {
  user_id: string;
  name: string;
  photo_url: string | null;
  skills: string[];
};

export type ExistingSupportRequest = {
  id: string;
  title: string;
  description: string;
  category: string;
  requested_date: string;
  requested_time: string;
  support_mode: string | null;
  volunteer_id: string | null;
  volunteer_name: string | null;
};

type FormMode = "create" | "view" | "edit";

function weekdayFromDate(value: string) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? "" : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()];
}

function isWithinSlot(time: string, start: string, end: string) {
  if (!time) return true;
  const selected = time.slice(0, 5);
  return start.slice(0, 5) <= selected && selected < end.slice(0, 5);
}

export function SubmitRequestForm({ mode = "create", request }: { mode?: FormMode; request?: ExistingSupportRequest }) {
  const router = useRouter();
  const readOnly = mode === "view";
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [time, setTime] = useState<string>("");
  const [supportMode, setSupportMode] = useState<string>("");
  const [volunteerChoice, setVolunteerChoice] = useState<"none" | "choose" | "auto">("none");
  const [chosenVolunteer, setChosenVolunteer] = useState<{ id: string; name: string; category: string; photoUrl: string | null } | null>(null);
  const [autoMatches, setAutoMatches] = useState<AutoMatchVolunteer[]>([]);
  const [matching, setMatching] = useState(false);
  const [matchError, setMatchError] = useState("");
  const [hasMatched, setHasMatched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const didHydrate = useRef(false);
  const matchRequestId = useRef(0);

  const MODES = ["Online", "In-person", "Text only"];

  useEffect(() => {
    if (mode !== "create") {
      if (request) {
        setSelectedCategory(request.category);
        setTitle(request.title);
        setDescription(request.description);
        setDate(request.requested_date);
        setTime(request.requested_time.slice(0, 5));
        setSupportMode(request.support_mode ?? "");
        if (request.volunteer_id) {
          setChosenVolunteer({ id: request.volunteer_id, name: request.volunteer_name ?? "Selected volunteer", category: request.category, photoUrl: null });
          setVolunteerChoice("choose");
        }
      }
      didHydrate.current = true;
      return;
    }
    try {
      const saved = sessionStorage.getItem(ASK_SUPPORT_DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved) as {
          selectedCategory?: string; title?: string; description?: string; date?: string; time?: string;
          supportMode?: string; volunteerChoice?: "none" | "choose" | "auto";
          chosenVolunteer?: { id: string; name: string; category: string; photoUrl?: string | null } | null;
        };
        if (draft.selectedCategory) setSelectedCategory(draft.selectedCategory);
        if (draft.title) setTitle(draft.title);
        if (draft.description) setDescription(draft.description);
        if (draft.date) setDate(draft.date);
        if (draft.time) setTime(draft.time);
        if (draft.supportMode) setSupportMode(draft.supportMode);
        if (draft.volunteerChoice) setVolunteerChoice(draft.volunteerChoice);
        if (draft.chosenVolunteer) {
          setChosenVolunteer({ ...draft.chosenVolunteer, photoUrl: draft.chosenVolunteer.photoUrl ?? null });
        }
      }
    } catch {
      try { sessionStorage.removeItem(ASK_SUPPORT_DRAFT_KEY); } catch { /* Storage can be unavailable in private browsing. */ }
    }

    const params = new URLSearchParams(window.location.search);
    const volunteerId = params.get("volunteerId");
    const volunteerName = params.get("volunteerName");
    const category = params.get("category");
    const volunteerPhoto = params.get("volunteerPhoto");

    if (category && SUBJECTS.includes(category as (typeof SUBJECTS)[number])) setSelectedCategory(category);
    if (params.get("date")) setDate(params.get("date")!);
    if (params.get("time")) setTime(params.get("time")!);
    if (params.get("mode")) setSupportMode(params.get("mode")!);
    if (volunteerId && volunteerName) {
      setChosenVolunteer({ id: volunteerId, name: volunteerName, category: category ?? "", photoUrl: volunteerPhoto });
      setVolunteerChoice("choose");
    }
    didHydrate.current = true;
  }, [mode, request]);

  useEffect(() => {
    if (!didHydrate.current || mode !== "create") return;
    try {
      sessionStorage.setItem(ASK_SUPPORT_DRAFT_KEY, JSON.stringify({
        selectedCategory, title, description, date, time, supportMode, volunteerChoice, chosenVolunteer,
      }));
    } catch { /* Keep the form usable when browser storage is unavailable. */ }
  }, [mode, selectedCategory, title, description, date, time, supportMode, volunteerChoice, chosenVolunteer]);

  function chooseVolunteer() {
    setVolunteerChoice("choose");
    try {
      sessionStorage.setItem(ASK_SUPPORT_DRAFT_KEY, JSON.stringify({
        selectedCategory, title, description, date, time, supportMode, volunteerChoice: "choose", chosenVolunteer,
      }));
    } catch { /* The in-memory form values are still used for this navigation. */ }
    const params = new URLSearchParams();
    if (selectedCategory) params.set("skill", selectedCategory);
    if (date) params.set("date", date);
    if (time) params.set("time", time);
    if (supportMode) params.set("mode", supportMode);
    const query = params.toString();
    router.push(`/volunteer-lists${query ? `?${query}` : ""}`);
  }

  async function findMatches() {
    const requestId = ++matchRequestId.current;
    setVolunteerChoice("auto");
    setChosenVolunteer(null);
    setAutoMatches([]);
    setMatchError("");
    setHasMatched(true);
    setMatching(true);

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (requestId !== matchRequestId.current) return;
    if (authError || !authData.user) {
      setMatchError("Please log in again before finding volunteers.");
      setMatching(false);
      return;
    }

    const { data: volunteerRows, error: volunteerError } = await supabase
      .from("volunteer_profile")
      .select("user_id, skills")
      .eq("is_volunteer", true);

    if (requestId !== matchRequestId.current) return;

    if (volunteerError) {
      setMatchError("We couldn't find volunteers right now. Please try again.");
      setMatching(false);
      return;
    }

    const eligibleRows = withoutOwnVolunteer(volunteerRows ?? [], authData.user.id).filter((row) =>
      matchesVolunteerSkill(row.skills ?? [], selectedCategory)
    );
    if (eligibleRows.length === 0) {
      setMatching(false);
      return;
    }

    const ids = eligibleRows.map((row) => row.user_id);
    const [{ data: profiles, error: profileError }, { data: slots, error: slotsError }] = await Promise.all([
      supabase.from("users").select("user_id, name, photo_url").in("user_id", ids),
      supabase.from("availability").select("user_id, day_of_week, start_time, end_time").in("user_id", ids),
    ]);

    if (requestId !== matchRequestId.current) return;

    if (profileError || slotsError) {
      setMatchError("We couldn't load volunteer details. Please try again.");
      setMatching(false);
      return;
    }

    const requestedDay = weekdayFromDate(date);
    const slotsByUser = new Map<string, { day: string; start: string; end: string }[]>();
    (slots ?? []).forEach((slot) => {
      const userSlots = slotsByUser.get(slot.user_id) ?? [];
      userSlots.push({ day: slot.day_of_week, start: slot.start_time, end: slot.end_time });
      slotsByUser.set(slot.user_id, userSlots);
    });

    const profileByUser = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]));
    const candidates = eligibleRows.flatMap((row) => {
    const profile = profileByUser.get(row.user_id);
    if (!profile) return [];

    return [{
      user_id: row.user_id,
      name: profile.name,
      photo_url: profile.photo_url,
      skills: row.skills ?? [],
      availability: slotsByUser.get(row.user_id) ?? [],
    }];
  });

  const matches = selectVolunteerRecommendations(
    candidates,
    authData.user.id,
    requestedDay,
    time,
  );

  setAutoMatches(matches);
  setMatching(false);
  }

  function clearAutoMatches() {
    matchRequestId.current += 1;
    setAutoMatches([]);
    setHasMatched(false);
    setMatching(false);
    setMatchError("");
    if (volunteerChoice === "auto") {
      setChosenVolunteer(null);
      setVolunteerChoice("none");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");
    if (mode === "view") return;
    if (!selectedCategory) {
      setSubmitError("Choose a category for your request.");
      return;
    }
    if (!supportMode) {
      setSubmitError("Choose a support mode for your request.");
      return;
    }
    if (mode === "create" && !chosenVolunteer) {
      setSubmitError("Choose a volunteer or select one from Auto-Match before submitting.");
      return;
    }

    setLoading(true);
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setSubmitError("Please log in again before submitting your request.");
      setLoading(false);
      return;
    }

    const volunteerId = chosenVolunteer?.id ?? request?.volunteer_id ?? null;
    if (isOwnVolunteer(volunteerId, authData.user.id)) {
      setSubmitError("You cannot select yourself as a volunteer.");
      setLoading(false);
      return;
    }

    const requestValues = {
      title: title.trim(),
      description: description.trim(),
      category: selectedCategory,
      requested_date: date,
      requested_time: time,
      support_mode: supportMode,
      volunteer_id: volunteerId,
      preferred_time: new Date(`${date}T${time}`).toISOString(),
    };
    const result = mode === "edit" && request
      ? await supabase.from("support_request").update(requestValues)
        .eq("request_id", request.id)
        .eq("requester_id", authData.user.id)
        .eq("status", "Pending")
        .select("request_id")
        .maybeSingle()
      : await (async () => {
        const { data: sessionData } = await supabase.auth.getSession();
        const response = await fetch("/api/support-requests", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(sessionData.session?.access_token ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {}),
          },
          body: JSON.stringify(requestValues),
        });
        const payload = await response.json().catch(() => ({}));
        return { data: null, error: response.ok ? null : { code: response.status === 400 && payload.fields?.volunteer_id === "You cannot select yourself as a volunteer." ? "SELF_VOLUNTEER" : "API_ERROR", message: payload.message ?? "Request submission failed.", details: "" } };
      })();
    const error = result.error;
    setLoading(false);
    if (error) {
      console.error("Support request save failed:", { code: error.code, message: error.message, details: error.details });
      if (error.code === "SELF_VOLUNTEER" || isSelfVolunteerConstraintError(error)) {
        setSubmitError("You cannot select yourself as a volunteer.");
      } else if (error.code === "42P01" || error.code === "PGRST205") {
        setSubmitError("Support request storage is not set up yet. Apply the support_request migration, then try again.");
      } else if (error.code === "42501") {
        setSubmitError("Your account doesn't have permission to submit this request. Check the support_request access policies.");
      } else if (error.code === "23503") {
        setSubmitError("The selected volunteer is no longer available. Choose another volunteer and try again.");
      } else {
        setSubmitError(`We couldn't ${mode === "edit" ? "save your changes" : "submit your request"}: ${error.message}`);
      }
      return;
    }

    if (mode === "edit" && !result.data) {
      setSubmitError("This request could not be edited. It may no longer be pending.");
      return;
    }

    if (mode === "create") {
      try { sessionStorage.removeItem(ASK_SUPPORT_DRAFT_KEY); } catch { /* Ignore unavailable browser storage. */ }
    }
    router.push("/support-requests");
  }

  return (
    <div className={styles.contentLayout}>
      
      <section className={styles.formSection}>
        <form onSubmit={handleSubmit} className={styles.form}>
          
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Category</label>
            <div className={styles.tagContainer}>
              {mode === "view" ? (
                <span className={`${styles.tag} ${styles.tagSelected} ${styles.tagView}`}>{selectedCategory}</span>
              ) : SUBJECTS.map((subject) => (
                <button
                  key={subject}
                  type="button"
                  disabled={readOnly}
                  onClick={() => { clearAutoMatches(); setSelectedCategory(subject); }}
                  className={selectedCategory === subject ? `${styles.tag} ${styles.tagSelected}` : styles.tag}
                >
                  {subject}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <input 
              type="text" 
              placeholder="Request Title" 
              className={styles.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={readOnly}
              required 
            />
          </div>

          <div className={styles.fieldGroup}>
            <textarea 
              placeholder="Description" 
              className={styles.textarea} 
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={readOnly}
              required
            />
          </div>

          <div className={styles.rowGrid}>
            <input 
              type="date" 
              className={styles.input} 
              value={date}
              onChange={(e) => { clearAutoMatches(); setDate(e.target.value); }}
              disabled={readOnly}
              required
            />
            <input 
              type="time" 
              className={styles.input} 
              value={time}
              onChange={(e) => { clearAutoMatches(); setTime(e.target.value); }}
              disabled={readOnly}
              required
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Support mode</label>
            <div className={styles.tagContainer}>
              {MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  disabled={readOnly}
                  onClick={() => { clearAutoMatches(); setSupportMode(mode); }}
                  className={supportMode === mode ? `${styles.tag} ${styles.tagSelected}` : styles.tag}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {submitError && <p className={styles.formError} role="alert">{submitError}</p>}
          {mode === "view" ? (
            <button type="button" className={styles.submitBtn} onClick={() => router.push(`/support-requests/${request?.id}?mode=edit`)}>Edit Request</button>
          ) : (
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? (mode === "edit" ? "Saving..." : "Submitting...") : mode === "edit" ? "Save edit" : "Submit request"}
            </button>
          )}
        </form>
      </section>

      <aside className={styles.volunteerSection}>
        {mode === "create" && <>
          <p className={styles.sectionDesc}>Choose a volunteer yourself or let CampusLink match you with one.</p>
          <div className={styles.toggleButtons}>
            <button type="button" className={`${styles.toggleBtn} ${volunteerChoice === "choose" ? styles.toggleBtnActive : ""}`} onClick={chooseVolunteer}>Choose Volunteer</button>
            <button type="button" className={`${styles.toggleBtn} ${volunteerChoice === "auto" ? styles.toggleBtnActive : ""}`} onClick={findMatches} disabled={matching}>Auto-Match</button>
          </div>
        </>}
        {volunteerChoice === "auto" && hasMatched && <div className={styles.autoMatchResults} aria-live="polite">
          {matching ? <p className={styles.matchMessage}>Finding matching volunteers…</p> : matchError ? <p className={styles.matchError} role="alert">{matchError}</p> : autoMatches.length === 0 ? <p className={styles.matchMessage}>No volunteers match your selected category and availability.</p> : (
            <>
              <p className={styles.matchHeading}>Matching volunteers (up to 3)</p>
              {autoMatches.map((volunteer) => {
                const category = selectedCategory || volunteer.skills[0] || "";
                const selected = chosenVolunteer?.id === volunteer.user_id;
                return <div className={styles.matchCard} key={volunteer.user_id}>
                  {volunteer.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className={styles.matchAvatar} src={volunteer.photo_url} alt="" />
                  ) : <span className={styles.matchAvatarFallback}>{volunteer.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span>}
                  <div className={styles.matchDetails}>
                    <strong>{volunteer.name}</strong>
                    <span>{category || volunteer.skills.join(", ")}</span>
                  </div>
                  <button
                    type="button"
                    className={selected ? styles.matchSelected : styles.matchSelect}
                    onClick={() => setChosenVolunteer({ id: volunteer.user_id, name: volunteer.name, category, photoUrl: volunteer.photo_url })}
                  >{selected ? "Selected" : "Select"}</button>
                </div>;
              })}
            </>
          )}
        </div>}
        {chosenVolunteer && (mode !== "create" || volunteerChoice === "choose") && <div className={styles.matchCard}>
          {chosenVolunteer.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.matchAvatar} src={chosenVolunteer.photoUrl} alt="" />
          ) : <span className={styles.matchAvatarFallback}>{chosenVolunteer.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span>}
          <div className={styles.matchDetails}>
            <strong>{chosenVolunteer.name}</strong>
            <span>{chosenVolunteer.category}</span>
          </div>
          <span className={styles.matchSelectedBadge}>Selected</span>
        </div>}
      </aside>

    </div>
  );
}
