import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { evidence, signInAs } from "./helpers";

const UNANSWERED_REQUEST_ID = "e9053af0-71d8-4f28-88a9-caae8e667162";
const UNANSWERED_STUDENT_EMAIL = "b2400541@helplive.edu.my";
const UNANSWERED_VOLUNTEER_EMAIL = "b2400857@helplive.edu.my";
const REPLACEMENT_VOLUNTEER_EMAIL = "b2400843@helplive.edu.my";

function credentials(emailVariable: string, passwordVariable: string) {
  const env = publicSupabaseConfig();
  const fixedEmail = emailVariable === "CL_STUDENT_EMAIL"
    ? "b2400541@helplive.edu.my"
    : emailVariable === REPLACEMENT_VOLUNTEER_EMAIL ? REPLACEMENT_VOLUNTEER_EMAIL : null;
  const email = fixedEmail ?? env[emailVariable];
  const password = env[passwordVariable];
  const missing = [
    ...(!email ? [emailVariable] : []),
    ...(!password ? [passwordVariable] : []),
  ];
  if (missing.length) throw new Error(`Missing environment variables: ${missing.join(", ")}.`);
  return { email, password };
}

function publicSupabaseConfig() {
  const envPath = path.resolve(__dirname, "..", "..", ".env.local");
  const env: Record<string, string> = {};
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const normalized = line.trim().replace(/^export\s+/, "");
    const separator = normalized.indexOf("=");
    if (separator < 0) continue;
    const key = normalized.slice(0, separator).trim();
    if (!key) continue;
    env[key] = normalized.slice(separator + 1).trim();
  }
  const missing = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"].filter((key) => !env[key]);
  if (missing.length) throw new Error(`Missing environment variables in frontend/.env.local: ${missing.join(", ")}.`);
  return env as Record<string, string>;
}

async function createPendingRequest(page: Parameters<typeof signInAs>[0], studentSession: Awaited<ReturnType<typeof signInAs>>, volunteerId: string, caseId: string) {
  const env = publicSupabaseConfig();
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${studentSession.access_token}` } },
  });
  const { data: availability, error: availabilityError } = await db.from("availability")
    .select("day_of_week,start_time,end_time")
    .eq("user_id", volunteerId);
  expect(availabilityError, `${caseId}: could not read volunteer availability through the student's authenticated session: ${availabilityError?.message ?? ""}`).toBeNull();
  expect(availability, `${caseId}: no availability rows were visible for volunteer ${volunteerId}.`).not.toBeNull();

  const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
  const klDateKey = (date: Date) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(date);
    const part = (type: string) => parts.find((item) => item.type === type)!.value;
    return `${part("year")}-${part("month")}-${part("day")}`;
  };
  const now = new Date();
  const nowKl = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const nowMinutes = Number(nowKl.find((part) => part.type === "hour")!.value) * 60
    + Number(nowKl.find((part) => part.type === "minute")!.value);
  const candidates: { requestedDate: string; requestedTime: string }[] = [];
  const attempts: string[] = [];

  for (let dayOffset = 1; dayOffset <= 30 && !candidates.length; dayOffset++) {
    const candidateDate = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    const requestedDate = klDateKey(candidateDate);
    const weekday = weekdayNames[new Date(`${requestedDate}T12:00:00+08:00`).getUTCDay()];
    const daySlots = (availability ?? []).filter((slot) => slot.day_of_week === weekday);
    if (!daySlots.length) {
      attempts.push(`${requestedDate} (${weekday}): no availability`);
      continue;
    }

    const { data: acceptedTimes, error: acceptedError } = await db.rpc("get_volunteer_accepted_times", {
      p_volunteer_id: volunteerId,
      p_requested_date: requestedDate,
    });
    if (acceptedError) {
      throw new Error(`${caseId}: could not query accepted requests for ${requestedDate}: ${acceptedError.message}`);
    }

    const dayCandidates: string[] = [];
    for (const slot of daySlots) {
      const slotStart = minutes(slot.start_time);
      const slotEnd = minutes(slot.end_time);
      for (let start = Math.ceil(slotStart / 60) * 60; start + 60 <= slotEnd; start += 60) {
        // The API requires at least one hour between now and the requested KL time.
        if (dayOffset === 1 && start <= nowMinutes) continue;
        const overlapsAccepted = ((acceptedTimes ?? []) as { requested_time: string }[]).some((accepted) => {
          const acceptedStart = minutes(accepted.requested_time);
          return start < acceptedStart + 60 && start + 60 > acceptedStart;
        });
        if (!overlapsAccepted) dayCandidates.push(`${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`);
      }
    }

    if (dayCandidates.length) candidates.push({ requestedDate, requestedTime: dayCandidates[0] });
    else {
      const acceptedLabels = ((acceptedTimes ?? []) as { requested_time: string }[])
        .map((item) => item.requested_time.slice(0, 5));
      attempts.push(`${requestedDate} (${weekday}): availability exists, but no eligible one-hour slot${acceptedLabels.length ? ` after excluding accepted times ${acceptedLabels.join(", ")}` : ""}${dayOffset === 1 ? " and applying the one-hour advance-booking rule" : ""}`);
    }
  }

  expect(candidates.length, `${caseId}: no valid Programming request slot found in the next 30 days. Attempts: ${attempts.join("; ")}`).toBeGreaterThan(0);
  const { requestedDate, requestedTime } = candidates[0];
  const title = `${caseId} notification request ${Date.now()}`;
  const response = await page.request.post("/api/support-requests", {
    headers: { Authorization: `Bearer ${studentSession.access_token}` },
    data: {
      title,
      description: `Automated ${caseId} end-to-end request.`,
      category: "Programming",
      requested_date: requestedDate,
      requested_time: requestedTime,
      support_mode: "Online",
      volunteer_id: volunteerId,
      preferred_time: new Date(`${requestedDate}T${requestedTime}:00+08:00`).toISOString(),
    },
  });
  expect(response.status(), `Creating the isolated ${caseId} request for ${requestedDate} ${requestedTime} KL failed after preflight selected a free availability slot: ${await response.text()}`).toBe(201);
  return title;
}

async function respondToRequest(page: Parameters<typeof signInAs>[0], volunteer: { email: string; password: string }, title: string, status: "Accepted" | "Declined") {
  await signInAs(page, volunteer.email, volunteer.password);
  await page.goto("/volunteer/requests");
  const requestCard = page.getByRole("listitem").filter({ hasText: title });
  await expect(requestCard, `Incoming ${status} test request ${title} did not load.`).toBeVisible({ timeout: 60_000 });
  await requestCard.getByRole("button", { name: status === "Accepted" ? "Accept" : "Decline", exact: true }).click();
  await expect(requestCard).toHaveCount(0, { timeout: 60_000 });
}

async function verifyStudentNotificationAndStatus(
  page: Parameters<typeof signInAs>[0],
  student: { email: string; password: string },
  title: string,
  status: "Accepted" | "Declined",
  caseId: string,
) {
  await signInAs(page, student.email, student.password);
  await page.goto("/support-requests");
  const requestRow = page.getByRole("row").filter({ has: page.getByRole("cell", { name: title, exact: true }) });
  await expect(requestRow, `${caseId} request row was not visible to its student requester.`).toBeVisible({ timeout: 60_000 });
  await expect(requestRow).toContainText(status);

  const notificationMessage = `Your support request was ${status.toLowerCase()}: "${title}".`;
  const notifications = page.getByRole("button", { name: /^Notifications/ });
  await expect(notifications).toBeVisible();
  await notifications.click();
  const panel = page.getByRole("dialog", { name: "Notifications" });
  await expect(panel.getByText(notificationMessage, { exact: true }), `${caseId} notification was not shown in the student's notification panel.`).toBeVisible({ timeout: 30_000 });
}

test("TCUC2_54 receives an Accepted notification and sees the updated request status", async ({ page }) => {
  const student = credentials("CL_STUDENT_EMAIL", "CL_STUDENT_PW");
  const volunteer = credentials("CL_EMAIL", "CL_PW");
  const volunteerSession = await signInAs(page, volunteer.email, volunteer.password);
  const studentSession = await signInAs(page, student.email, student.password);
  expect(studentSession.user.id, "The test student and volunteer must be different accounts.").not.toBe(volunteerSession.user.id);

  const title = await createPendingRequest(page, studentSession, volunteerSession.user.id, "TCUC2_54");
  await respondToRequest(page, volunteer, title, "Accepted");
  await verifyStudentNotificationAndStatus(page, student, title, "Accepted", "TCUC2_54");
  await evidence(page, "TCUC2_54");
});

test("TCUC2_55 receives a Declined notification and sees the updated request status", async ({ page }) => {
  const student = credentials("CL_STUDENT_EMAIL", "CL_STUDENT_PW");
  const volunteer = credentials("CL_EMAIL", "CL_PW");
  const volunteerSession = await signInAs(page, volunteer.email, volunteer.password);
  const studentSession = await signInAs(page, student.email, student.password);
  expect(studentSession.user.id, "The test student and volunteer must be different accounts.").not.toBe(volunteerSession.user.id);

  const title = await createPendingRequest(page, studentSession, volunteerSession.user.id, "TCUC2_55");
  await respondToRequest(page, volunteer, title, "Declined");
  await verifyStudentNotificationAndStatus(page, student, title, "Declined", "TCUC2_55");
  await evidence(page, "TCUC2_55");
});

test("TCUC2_56 displays the latest support request status", async ({ page }) => {
  const student = credentials("CL_STUDENT_EMAIL", "CL_STUDENT_PW");
  const volunteer = credentials("CL_EMAIL", "CL_PW");
  const volunteerSession = await signInAs(page, volunteer.email, volunteer.password);
  const studentSession = await signInAs(page, student.email, student.password);
  expect(studentSession.user.id, "The test student and volunteer must be different accounts.").not.toBe(volunteerSession.user.id);

  const title = await createPendingRequest(page, studentSession, volunteerSession.user.id, "TCUC2_56");
  await respondToRequest(page, volunteer, title, "Accepted");
  await signInAs(page, student.email, student.password);
  await page.goto("/support-requests");
  const requestRow = page.getByRole("row").filter({ has: page.getByRole("cell", { name: title, exact: true }) });
  await expect(requestRow, "The student's support request status page did not show the updated request.").toBeVisible({ timeout: 60_000 });
  await expect(requestRow).toContainText("Accepted");
  await evidence(page, "TCUC2_56");
});

test("TCUC2_57 reassigns a Pending request after its unanswered reminder", async ({ page }) => {
  const currentVolunteer = credentials("CL_ORIGINAL_VOLUNTEER_EMAIL", "CL_ORIGINAL_VOLUNTEER_PW");
  const replacementVolunteer = credentials(REPLACEMENT_VOLUNTEER_EMAIL, "CL_REPLACEMENT_VOLUNTEER_PW");
  const studentPassword = credentials("CL_STUDENT_EMAIL", "CL_STUDENT_PW").password;

  // Authenticate the accounts in turn so the browser ends with the student session,
  // while retaining their user IDs for the preflight and final database assertions.
  const currentVolunteerSession = await signInAs(page, currentVolunteer.email, currentVolunteer.password);
  const replacementSession = await signInAs(page, replacementVolunteer.email, replacementVolunteer.password);
  const studentSession = await signInAs(page, UNANSWERED_STUDENT_EMAIL, studentPassword);
  const env = publicSupabaseConfig();
  const configuredHost = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname;
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${studentSession.access_token}` } },
  });

  const { data: target, error: targetError } = await db.from("support_request")
    .select("request_id,title,requester_id,volunteer_id,status,assignment_version")
    .eq("request_id", UNANSWERED_REQUEST_ID)
    .eq("requester_id", studentSession.user.id)
    .maybeSingle();
  expect(targetError, `Could not read request ${UNANSWERED_REQUEST_ID} through the student's permitted Supabase session.`).toBeNull();
  expect(target, `Request ${UNANSWERED_REQUEST_ID} is not visible to the authenticated student in the configured Supabase project.`).not.toBeNull();
  expect(target).toMatchObject({
    request_id: UNANSWERED_REQUEST_ID,
    title: "TCUC2_57 Handle unanswered support request",
    requester_id: studentSession.user.id,
    volunteer_id: currentVolunteerSession.user.id,
    status: "Pending",
  });
  expect(target!.assignment_version, "The prepared request has no current assignment version.").toBeGreaterThan(0);

  const { data: reminders, error: reminderError } = await db.from("notification")
    .select("type,event_key,request_id")
    .eq("request_id", UNANSWERED_REQUEST_ID)
    .eq("type", "request_no_response");
  expect(reminderError, "Could not read the prepared reminder through the student's permitted Supabase session.").toBeNull();
  expect(reminders, "No request_no_response reminder exists for the prepared request's current assignment.").toContainEqual(expect.objectContaining({
    request_id: UNANSWERED_REQUEST_ID,
    type: "request_no_response",
    event_key: `request:${UNANSWERED_REQUEST_ID}:no-response:${target!.assignment_version}`,
  }));

  const { data: replacement, error: replacementError } = await db.from("users")
    .select("user_id,name")
    .eq("user_id", replacementSession.user.id)
    .maybeSingle();
  expect(replacementError, "Could not resolve the replacement volunteer's profile through the student's session.").toBeNull();
  expect(replacement?.user_id).toBe(replacementSession.user.id);
  expect(replacement?.name, "The replacement volunteer has no visible directory name.").toBeTruthy();

  const listResponsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === "/rest/v1/support_request" && url.searchParams.has("requester_id");
  });
  await page.goto("/support-requests");
  await expect(page.getByRole("heading", { name: "My Support Requests" })).toBeVisible({ timeout: 60_000 });
  const listResponse = await listResponsePromise;
  const browserRequestUrl = new URL(listResponse.url());
  const requesterFilter = browserRequestUrl.searchParams.get("requester_id");
  const authorization = (await listResponse.request().allHeaders()).authorization ?? "";
  const tokenMatch = authorization.match(/^Bearer\s+([^.]+\.[^.]+\.[^.]+)$/i);
  let browserSessionUserId: string | null = null;
  if (tokenMatch) {
    try {
      // Decode only the JWT subject. The token itself is never logged or included in errors.
      browserSessionUserId = JSON.parse(Buffer.from(tokenMatch[1].split(".")[1], "base64url").toString("utf8")).sub ?? null;
    } catch {
      browserSessionUserId = null;
    }
  }
  let browserHasTarget = false;
  try {
    const rows = await listResponse.json();
    browserHasTarget = Array.isArray(rows) && rows.some((row) => row?.request_id === UNANSWERED_REQUEST_ID);
  } catch {
    browserHasTarget = false;
  }

  expect(browserRequestUrl.hostname, "The browser page queried a different Supabase project host than the test preflight.").toBe(configuredHost);
  expect(requesterFilter, "The browser page's requester_id filter did not use the signed-in student's ID.").toBe(`eq.${studentSession.user.id}`);
  expect(browserSessionUserId, "The browser's Supabase Authorization session does not belong to the signed-in student.").toBe(studentSession.user.id);
  expect(listResponse.ok(), `The browser's support_request query failed with HTTP ${listResponse.status()} on ${browserRequestUrl.hostname}.`).toBeTruthy();
  expect(browserHasTarget, `The browser queried ${browserRequestUrl.hostname} with the student's requester filter and session, but Supabase did not return prepared request ${UNANSWERED_REQUEST_ID}; check project data and RLS visibility.`).toBe(true);

  const requestRow = page.getByRole("row").filter({ has: page.getByRole("cell", { name: "TCUC2_57 Handle unanswered support request", exact: true }) });
  await expect(requestRow, `Prepared request ${UNANSWERED_REQUEST_ID} was returned by Supabase but not rendered in the student's request list.`).toHaveCount(1);
  await expect(requestRow).toContainText("Pending");
  await expect(requestRow.locator('[aria-label="No response for 24 hours"]'), "The current unanswered reminder is not visible on the prepared request row.").toBeVisible();

  await requestRow.getByRole("button", { name: /Actions/ }).click();
  const changeVolunteer = page.getByRole("menuitem", { name: /Change Volunteer/ });
  await expect(changeVolunteer, "Change Volunteer is not available despite the prepared reminder.").toBeVisible();
  await changeVolunteer.click();
  await expect(page).toHaveURL(new RegExp(`/support-requests/${UNANSWERED_REQUEST_ID}\\?mode=change-volunteer`));

  await page.getByRole("button", { name: "Change Volunteer", exact: true }).click();
  await expect(page).toHaveURL(/\/volunteer-lists\/?(?:\?.*)?$/);
  const replacementCard = page.locator("li").filter({ has: page.getByRole("heading", { name: replacement!.name!, exact: true }) });
  await expect(replacementCard, `Replacement volunteer ${replacement!.name} did not appear in the real volunteer directory.`).toBeVisible({ timeout: 60_000 });
  await replacementCard.getByRole("heading", { name: replacement!.name!, exact: true }).click();
  await replacementCard.getByRole("button", { name: "Choose Volunteer" }).click();
  await expect(page).toHaveURL(new RegExp(`/support-requests/${UNANSWERED_REQUEST_ID}\\?`));
  await expect(page.getByText(replacement!.name!, { exact: true })).toBeVisible();
  const confirm = page.getByRole("button", { name: "Confirm New Volunteer", exact: true });
  await expect(confirm).toBeVisible();
  const reassignResponsePromise = page.waitForResponse((response) => new URL(response.url()).pathname === `/api/support-requests/${UNANSWERED_REQUEST_ID}/reassign`);
  await confirm.click();
  const reassignResponse = await reassignResponsePromise;
  const reassignAuthorization = (await reassignResponse.request().allHeaders()).authorization ?? "";
  const reassignToken = reassignAuthorization.match(/^Bearer\s+([^.]+\.[^.]+\.[^.]+)$/i)?.[1];
  let reassignUserId: string | null = null;
  if (reassignToken) {
    try {
      reassignUserId = JSON.parse(Buffer.from(reassignToken.split(".")[1], "base64url").toString("utf8")).sub ?? null;
    } catch {
      reassignUserId = null;
    }
  }
  const reassignBody = await reassignResponse.json().catch(() => ({}));
  expect(reassignResponse.status(), `The UI reassignment API returned HTTP ${reassignResponse.status()} (${reassignBody.message ?? "no error message"}); bearer subject matched student: ${reassignUserId === studentSession.user.id}.`).toBe(200);

  await expect(page).toHaveURL(/\/support-requests\?volunteerChanged=1$/);
  await expect(page.getByText("Volunteer Changed Successfully!", { exact: true })).toBeVisible({ timeout: 30_000 });
  const reassignedRow = page.getByRole("row").filter({ has: page.getByRole("cell", { name: "TCUC2_57 Handle unanswered support request", exact: true }) });
  await expect(reassignedRow).toHaveCount(1, { timeout: 60_000 });
  await expect(reassignedRow).toContainText("Pending");
  await expect(reassignedRow).toContainText(replacement!.name!);

  const { data: finalRequest, error: finalError } = await db.from("support_request")
    .select("request_id,requester_id,volunteer_id,status,assignment_version")
    .eq("request_id", UNANSWERED_REQUEST_ID)
    .eq("requester_id", studentSession.user.id)
    .maybeSingle();
  expect(finalError, `Could not verify request ${UNANSWERED_REQUEST_ID} after the UI reassignment.`).toBeNull();
  expect(finalRequest).toMatchObject({
    request_id: UNANSWERED_REQUEST_ID,
    requester_id: studentSession.user.id,
    volunteer_id: replacementSession.user.id,
    status: "Pending",
    assignment_version: target!.assignment_version + 1,
  });

  await evidence(page, "TCUC2_57");
});
