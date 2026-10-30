"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SUBJECTS } from "@/lib/categories";
import { ASK_SUPPORT_DRAFT_KEY } from "@/lib/askSupportDraft";
import { klDateKey, TZ } from "@/lib/sessions/time";
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
type FormInitialValues = {
  selectedCategory: string;
  title: string;
  description: string;
  date: string;
  time: string;
  supportMode: string;
  volunteerChoice: "none" | "choose" | "auto";
  chosenVolunteer: { id: string; name: string; category: string; photoUrl: string | null } | null;
};

const EMPTY_FORM_VALUES: FormInitialValues = {
  selectedCategory: "", title: "", description: "", date: "", time: "", supportMode: "",
  volunteerChoice: "none", chosenVolunteer: null,
};

// `search` comes from Next's router (useSearchParams), not window.location: during a client-side navigation
// (e.g. back from the volunteer list) the address bar is not updated yet while this page first renders.
function createInitialValuesSnapshot(search: string) {
  if (typeof window === "undefined") return "";
  let initial: FormInitialValues = { ...EMPTY_FORM_VALUES };
  try {
    const saved = sessionStorage.getItem(ASK_SUPPORT_DRAFT_KEY);
    if (saved) initial = { ...initial, ...JSON.parse(saved) as Partial<FormInitialValues> };
  } catch {
    try { sessionStorage.removeItem(ASK_SUPPORT_DRAFT_KEY); } catch { /* Storage may be unavailable. */ }
  }

  const params = new URLSearchParams(search);
  const category = params.get("category");
  if (category && SUBJECTS.includes(category as (typeof SUBJECTS)[number])) initial.selectedCategory = category;
  if (params.get("date")) initial.date = params.get("date")!;
  if (params.get("time")) initial.time = params.get("time")!;
  if (params.get("mode")) initial.supportMode = params.get("mode")!;
  const volunteerId = params.get("volunteerId");
  const volunteerName = params.get("volunteerName");
  if (volunteerId && volunteerName) {
    initial.chosenVolunteer = {
      id: volunteerId,
      name: volunteerName,
      category: category ?? "",
      photoUrl: params.get("volunteerPhoto"),
    };
    initial.volunteerChoice = "choose";
  }
  return JSON.stringify(initial);
}

const getServerInitializationSnapshot = () => "";

function valuesFromRequest(request?: ExistingSupportRequest): FormInitialValues {
  if (!request) return EMPTY_FORM_VALUES;
  return {
    selectedCategory: request.category,
    title: request.title,
    description: request.description,
    date: request.requested_date,
    time: request.requested_time.slice(0, 5),
    supportMode: request.support_mode ?? "",
    volunteerChoice: request.volunteer_id ? "choose" : "none",
    chosenVolunteer: request.volunteer_id ? {
      id: request.volunteer_id,
      name: request.volunteer_name ?? "Selected volunteer",
      category: request.category,
      photoUrl: null,
    } : null,
  };
}

function weekdayFromDate(value: string) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00+08:00`);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(date);
}

function formatSelectedDate(value: string) {
  if (!value) return "";
  const parsed = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return "";
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long" }).format(parsed);
  return `${parsed.getUTCMonth() + 1}/${parsed.getUTCDate()}/${parsed.getUTCFullYear()}, ${weekday}`;
}

function localDateValue(date: Date) {
  return klDateKey(date.toISOString());
}

function isWithinSlot(time: string, start: string, end: string) {
  if (!time) return true;
  const selected = time.slice(0, 5);
  return start.slice(0, 5) <= selected && selected < end.slice(0, 5);
}

export function SubmitRequestForm(props: { mode?: FormMode; request?: ExistingSupportRequest; canEdit?: boolean }) {
  const mode = props.mode ?? "create";
  const search = useSearchParams().toString();
  const snapshotRef = useRef<{ search: string; value: string } | null>(null);
  const getSnapshot = useCallback(() => {
    if (snapshotRef.current?.search !== search) snapshotRef.current = { search, value: createInitialValuesSnapshot(search) };
    return snapshotRef.current.value;
  }, [search]);
  const subscribe = useCallback((onChange: () => void) => {
    const handlePopState = () => {
      snapshotRef.current = null;
      onChange();
    };
    if (typeof window === "undefined") return () => {};
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerInitializationSnapshot);
  let initialValues = valuesFromRequest(props.request);
  if (mode === "create" && snapshot) {
    try { initialValues = JSON.parse(snapshot) as FormInitialValues; } catch { initialValues = EMPTY_FORM_VALUES; }
  }
  const key = mode === "create" ? `create:${snapshot}` : `${mode}:${JSON.stringify(props.request ?? null)}`;
  return <SubmitRequestFormContent key={key} {...props} mode={mode} initialValues={initialValues} initialReady={mode !== "create" || Boolean(snapshot)} />;
}

function SubmitRequestFormContent({ mode = "create", request, canEdit = true, initialValues, initialReady }: {
  mode?: FormMode;
  request?: ExistingSupportRequest;
  canEdit?: boolean;
  initialValues: FormInitialValues;
  initialReady: boolean;
}) {
  const router = useRouter();
  const readOnly = mode === "view";
  const [selectedCategory, setSelectedCategory] = useState<string>(initialValues.selectedCategory);
  const [title, setTitle] = useState<string>(initialValues.title);
  const [description, setDescription] = useState<string>(initialValues.description);
  const [date, setDate] = useState<string>(initialValues.date);
  const [time, setTime] = useState<string>(initialValues.time);
  const [supportMode, setSupportMode] = useState<string>(initialValues.supportMode);
  const [volunteerChoice, setVolunteerChoice] = useState<"none" | "choose" | "auto">(initialValues.volunteerChoice);
  const [chosenVolunteer, setChosenVolunteer] = useState(initialValues.chosenVolunteer);
  const [autoMatches, setAutoMatches] = useState<AutoMatchVolunteer[]>([]);
  const [matching, setMatching] = useState(false);
  const [matchError, setMatchError] = useState("");
  const [hasMatched, setHasMatched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [validationError, setValidationError] = useState<{ field: string; message: string } | null>(null);
  const matchRequestId = useRef(0);
  const isSubmitting = useRef(false);

  const MODES = ["Online", "In-person"];

  function clearValidationError() {
    setValidationError(null);
  }

  useEffect(() => {
    if (!initialReady || mode !== "create") return;
    try {
      sessionStorage.setItem(ASK_SUPPORT_DRAFT_KEY, JSON.stringify({
        selectedCategory, title, description, date, time, supportMode, volunteerChoice, chosenVolunteer,
      }));
    } catch { /* Keep the form usable when browser storage is unavailable. */ }
  }, [initialReady, mode, selectedCategory, title, description, date, time, supportMode, volunteerChoice, chosenVolunteer]);

  function chooseVolunteer() {
    clearValidationError();
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
    params.set("from", "ask-for-support");
    const query = params.toString();
    router.push(`/volunteer-lists${query ? `?${query}` : ""}`);
  }

  async function findMatches() {
    const requestId = ++matchRequestId.current;
    clearValidationError();
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
    if (isSubmitting.current) return;
    setSubmitError("");
    if (mode === "view") return;
    const requiredFields: { field: string; value: string; message: string }[] = [
      { field: "category", value: selectedCategory, message: "Please select a category." },
      { field: "title", value: title.trim(), message: "Please fill out this field." },
      { field: "description", value: description.trim(), message: "Please fill out this field." },
      { field: "date", value: date, message: "Please select a date." },
      { field: "time", value: time, message: "Please select a time." },
      { field: "supportMode", value: supportMode, message: "Please select a support mode." },
      ...(mode === "create" ? [{ field: "volunteer", value: chosenVolunteer?.id ?? "", message: "Please select a volunteer." }] : []),
    ];
    const missing = requiredFields.find((field) => !field.value);
    if (missing) {
      setValidationError(missing);
      return;
    }
    setValidationError(null);
    isSubmitting.current = true;
    setLoading(true);
    const failValidation = (field: string, message: string) => {
      setValidationError({ field, message });
      setLoading(false);
      isSubmitting.current = false;
    };
    if (mode === "create" && volunteerChoice === "choose" && chosenVolunteer) {
      let volunteerProfile;
      let volunteerSlots;
      let profileError;
      let availabilityError;
      try {
        [{ data: volunteerProfile, error: profileError }, { data: volunteerSlots, error: availabilityError }] = await Promise.all([
          supabase.from("volunteer_profile").select("skills").eq("user_id", chosenVolunteer.id).eq("is_volunteer", true).maybeSingle(),
          supabase.from("availability").select("day_of_week, start_time, end_time").eq("user_id", chosenVolunteer.id),
        ]);
      } catch {
        failValidation("volunteer", "We couldn't verify this volunteer's profile and availability. Please try again.");
        return;
      }
      if (profileError || availabilityError || !volunteerProfile) {
        failValidation("volunteer", "We couldn't verify this volunteer's profile and availability. Please try again.");
        return;
      }
      if (!(volunteerProfile.skills ?? []).includes(selectedCategory)) {
        failValidation("category", "The selected category does not match this volunteer's skills.");
        return;
      }
      if (date < localDateValue(new Date())) {
        failValidation("date", "Please select today or a future date.");
        return;
      }
      const day = weekdayFromDate(date);
      const daySlots = (volunteerSlots ?? []).filter((slot) => slot.day_of_week === day);
      if (daySlots.length === 0) {
        failValidation("date", "This volunteer is not available on the selected date.");
        return;
      }
      if (!daySlots.some((slot) => isWithinSlot(time, slot.start_time, slot.end_time))) {
        failValidation("time", "This volunteer is not available at the selected time.");
        return;
      }
    }
    if (date < localDateValue(new Date())) {
      failValidation("date", "Please select today or a future date.");
      return;
    }
    const selectedDateTime = new Date(`${date}T${time}:00+08:00`);
    if (!date || !time || Number.isNaN(selectedDateTime.getTime()) || selectedDateTime.getTime() < Date.now() + 60 * 60 * 1000) {
      failValidation("time", "Please choose a time at least 1 hour from now.");
      return;
    }
    const authResult = await supabase.auth.getUser().catch(() => null);
    if (!authResult || authResult.error || !authResult.data.user) {
      setSubmitError("Please log in again before submitting your request.");
      setLoading(false);
      isSubmitting.current = false;
      return;
    }
    const authData = authResult.data;

    const volunteerId = chosenVolunteer?.id ?? request?.volunteer_id ?? null;
    if (isOwnVolunteer(volunteerId, authData.user.id)) {
      setSubmitError("You cannot select yourself as a volunteer.");
      setLoading(false);
      isSubmitting.current = false;
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
      preferred_time: new Date(`${date}T${time}:00+08:00`).toISOString(),
    };
    const result = mode === "edit" && request
      ? await supabase.from("support_request").update(requestValues)
        .eq("request_id", request.id)
        .eq("requester_id", authData.user.id)
        .eq("status", "Pending")
        .select("request_id")
        .maybeSingle()
      : await (async () => {
        try {
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
        } catch {
          return { data: null, error: { code: "NETWORK_ERROR", message: "Network error. Please check your connection and try again.", details: "" } };
        }
      })();
    const error = result.error;
    setLoading(false);
    isSubmitting.current = false;
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
      router.push("/support-requests?submitted=1");
      return;
    }
    router.push("/support-requests");
  }

  return (
    <div className={styles.contentLayout}>
      
      <section className={styles.formSection}>
        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Category</label>
            {validationError?.field === "category" && <p className={styles.validationTooltip} role="alert">{validationError.message}</p>}
            <div className={styles.tagContainer}>
              {mode === "view" ? (
                <span className={`${styles.tag} ${styles.tagSelected} ${styles.tagView}`}>{selectedCategory}</span>
              ) : SUBJECTS.map((subject) => (
                <button
                  key={subject}
                  type="button"
                  disabled={readOnly || loading}
                  onClick={() => { clearAutoMatches(); setSelectedCategory(subject); clearValidationError(); }}
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
              onChange={(e) => { setTitle(e.target.value); clearValidationError(); }}
              disabled={readOnly || loading}
            />
            {validationError?.field === "title" && <p className={styles.validationTooltip} role="alert">{validationError.message}</p>}
          </div>

          <div className={styles.fieldGroup}>
            <textarea 
              placeholder="Description" 
              className={styles.textarea} 
              rows={6}
              value={description}
              onChange={(e) => { setDescription(e.target.value); clearValidationError(); }}
              disabled={readOnly || loading}
            />
            {validationError?.field === "description" && <p className={styles.validationTooltip} role="alert">{validationError.message}</p>}
          </div>

          <div className={styles.rowGrid}>
            <div className={styles.fieldGroup}>
            <div className={styles.dateInputWrap}>
            <input
              type="date" 
              className={`${styles.input} ${date ? styles.dateInputWithLabel : ""}`}
              value={date}
              min={localDateValue(new Date())}
              onChange={(e) => { clearAutoMatches(); setDate(e.target.value); clearValidationError(); }}
              disabled={readOnly || loading}
            />
            {date && <span className={styles.dateDisplay} aria-hidden="true">{formatSelectedDate(date)}</span>}
            </div>
            {validationError?.field === "date" && <p className={styles.validationTooltip} role="alert">{validationError.message}</p>}
            </div>
            <div className={styles.fieldGroup}>
              <input
                type="time"
                className={styles.input}
                value={time}
                onChange={(e) => { clearAutoMatches(); setTime(e.target.value); clearValidationError(); }}
                disabled={readOnly || loading}
              />
              {validationError?.field === "time" && <p className={styles.validationTooltip} role="alert">{validationError.message}</p>}
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Support mode</label>
            {validationError?.field === "supportMode" && <p className={styles.validationTooltip} role="alert">{validationError.message}</p>}
            <div className={styles.tagContainer}>
              {MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  disabled={readOnly || loading}
                  onClick={() => { clearAutoMatches(); setSupportMode(mode); clearValidationError(); }}
                  className={supportMode === mode ? `${styles.tag} ${styles.tagSelected}` : styles.tag}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {submitError && <p className={styles.formError} role="alert">{submitError}</p>}
          {mode === "view" && canEdit ? (
            <button type="button" className={styles.submitBtn} onClick={() => router.push(`/support-requests/${request?.id}?mode=edit`)}>Edit Request</button>
          ) : mode === "view" ? null : (
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? (mode === "edit" ? "Saving..." : "Submitting...") : mode === "edit" ? "Save edit" : "Submit request"}
            </button>
          )}
        </form>
      </section>

      <aside className={styles.volunteerSection}>
        {mode === "create" && <>
          <h2 className={styles.sectionHeading}>Volunteer</h2>
          {validationError?.field === "volunteer" && <p className={styles.validationTooltip} role="alert">{validationError.message}</p>}
          <p className={styles.sectionDesc}>Choose a volunteer yourself or let CampusLink match you with one.</p>
          <div className={styles.toggleButtons}>
            <button type="button" className={`${styles.toggleBtn} ${volunteerChoice === "choose" ? styles.toggleBtnActive : ""}`} onClick={chooseVolunteer} disabled={loading}>Choose Volunteer</button>
            <button type="button" className={`${styles.toggleBtn} ${volunteerChoice === "auto" ? styles.toggleBtnActive : ""}`} onClick={findMatches} disabled={matching || loading}>Auto-Match</button>
          </div>
        </>}
        {volunteerChoice === "auto" && hasMatched && <div className={styles.autoMatchResults} aria-live="polite">
          {matching ? <p className={styles.matchMessage}>Finding matching volunteers…</p> : matchError ? <p className={styles.matchError} role="alert">{matchError}</p> : autoMatches.length === 0 ? <p className={styles.matchMessage}>No volunteers match your selected category and availability.</p> : (
            <>
              <p className={styles.matchHeading}>Matching volunteers</p>
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
                    disabled={loading}
                    onClick={() => { setChosenVolunteer({ id: volunteer.user_id, name: volunteer.name, category, photoUrl: volunteer.photo_url }); clearValidationError(); }}
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
