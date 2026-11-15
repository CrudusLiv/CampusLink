import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { evidence, signInAs } from "./helpers";

const TARGET_REQUEST_ID = "41e7af05-e2e2-459f-bbc9-5e9d23ac5721";
const CONFLICT_REQUEST_ID = "5e7019d8-5fea-4843-b328-6a56f796047f";
const STUDENT_EMAIL = "b2400541@helplive.edu.my";
const ORIGINAL_VOLUNTEER_ID = "28804504-606e-4ffb-a0c4-ed415dd1a7a7";
const CONFLICT_VOLUNTEER_ID = "d8439677-1502-4902-ac34-7b3be8426c1c";
const EXPECTED_TITLE = "E2E TCUC2_45 Change Volunteer Test";
const CONFLICT_MESSAGE = "The selected volunteer already has an accepted request at this time. Choose another available volunteer.";

function credentials(email: string, passwordVariable: string) {
  const password = process.env[passwordVariable];
  if (!password) {
    throw new Error(`TCUC2_45 requires ${passwordVariable} in the test environment for ${email}. Passwords are not stored in the test.`);
  }
  return password;
}

function publicSupabaseConfig() {
  const envPath = path.join(__dirname, "..", "..", ".env.local");
  const env = Object.fromEntries(readFileSync(envPath, "utf8").split(/\r?\n/)
    .filter((line) => line.includes("="))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1).trim()]));
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("TCUC2_45 requires the existing public Supabase URL and anon key in frontend/.env.local.");
  }
  return env as Record<string, string>;
}

test("TCUC2_45 rejects changing a Pending request to a volunteer with an accepted appointment conflict", async ({ page }) => {
  const studentPassword = credentials(STUDENT_EMAIL, "CL_STUDENT_PW");
  const studentSession = await signInAs(page, STUDENT_EMAIL, studentPassword);
  const env = publicSupabaseConfig();
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${studentSession.access_token}` } },
  });

  const { data: target, error: targetError } = await db.from("support_request")
    .select("request_id,title,volunteer_id,status,requested_date,requested_time,assignment_version")
    .eq("request_id", TARGET_REQUEST_ID).eq("requester_id", studentSession.user.id).maybeSingle();
  expect(targetError, `Could not read TCUC2_45 through the student's permitted session: ${targetError?.message ?? ""}`).toBeNull();
  expect(target, `TCUC2_45 request ${TARGET_REQUEST_ID} is missing or is not owned by ${STUDENT_EMAIL}.`).not.toBeNull();
  expect(target, `TCUC2_45 must have its expected title; found ${target!.title}.`).toMatchObject({ title: EXPECTED_TITLE });
  expect(target, `TCUC2_45 must still be Pending; found ${target!.status}.`).toMatchObject({ status: "Pending" });
  expect(target, `TCUC2_45 must still be assigned to B2400857 (${ORIGINAL_VOLUNTEER_ID}); found ${target!.volunteer_id}.`).toMatchObject({ volunteer_id: ORIGINAL_VOLUNTEER_ID });
  expect(target, `TCUC2_45 assignment_version must remain 1; found ${target!.assignment_version}.`).toMatchObject({ assignment_version: 1 });

  const { data: conflict, error: conflictError } = await db.from("support_request")
    .select("request_id,volunteer_id,status,requested_date,requested_time,assignment_version")
    .eq("request_id", CONFLICT_REQUEST_ID).maybeSingle();
  expect(conflictError, `Could not read TCUC2_44 through the student's permitted session: ${conflictError?.message ?? ""}`).toBeNull();
  expect(conflict, `TCUC2_44 request ${CONFLICT_REQUEST_ID} is missing or not visible through the student's session.`).not.toBeNull();
  expect(conflict, `TCUC2_44 must still be Accepted; found ${conflict!.status}.`).toMatchObject({ status: "Accepted" });
  expect(conflict, `TCUC2_44 must still be assigned to B2400843 (${CONFLICT_VOLUNTEER_ID}); found ${conflict!.volunteer_id}.`).toMatchObject({ volunteer_id: CONFLICT_VOLUNTEER_ID });
  expect(conflict!.requested_date, "TCUC2_45 and TCUC2_44 must have the same requested date for the appointment conflict.").toBe(target!.requested_date);
  const targetStart = Number(target!.requested_time.slice(0, 2)) * 60 + Number(target!.requested_time.slice(3, 5));
  const conflictStart = Number(conflict!.requested_time.slice(0, 2)) * 60 + Number(conflict!.requested_time.slice(3, 5));
  expect(targetStart < conflictStart + 60 && targetStart + 60 > conflictStart,
    `Appointments must overlap (one-hour slots): TCUC2_45=${target!.requested_time}, TCUC2_44=${conflict!.requested_time}.`).toBe(true);

  const { data: replacementProfile, error: profileError } = await db.from("users")
    .select("name").eq("user_id", CONFLICT_VOLUNTEER_ID).maybeSingle();
  expect(profileError, `Could not resolve B2400843's volunteer profile through the student's permitted session: ${profileError?.message ?? ""}`).toBeNull();
  expect(replacementProfile?.name, `B2400843 (${CONFLICT_VOLUNTEER_ID}) has no visible volunteer profile.`).toBeTruthy();
  const replacementName = replacementProfile!.name;

  await page.goto("/support-requests");
  await expect(page.getByRole("heading", { name: "My Support Requests" })).toBeVisible({ timeout: 60_000 });
  // The table does not render request IDs. Match the title, then verify the menu's
  // detail href against the exact database ID before following Change Volunteer.
  const titleRow = page.getByRole("row")
    .filter({ has: page.getByRole("cell", { name: EXPECTED_TITLE, exact: true }) })
    .filter({ hasText: "Pending" });
  await expect(titleRow, `Pending request titled ${EXPECTED_TITLE} was not found uniquely; database preflight confirmed request ID ${TARGET_REQUEST_ID}.`).toHaveCount(1, { timeout: 60_000 });
  await titleRow.getByRole("button", { name: /Actions/ }).click();
  const detailLink = page.getByRole("menuitem", { name: "View", exact: true });
  await expect(detailLink).toHaveAttribute("href", `/support-requests/${TARGET_REQUEST_ID}?mode=view`);
  await expect(titleRow.locator('[aria-label="No response for 24 hours"]'), `Change Volunteer requires the current no-response reminder for ${TARGET_REQUEST_ID}.`).toBeVisible();
  const changeVolunteer = page.getByRole("menuitem", { name: "Change Volunteer" });
  await expect(changeVolunteer, `Change Volunteer is unavailable for ${TARGET_REQUEST_ID}; the request may lack its current no-response reminder prerequisite.`).toBeVisible();
  await changeVolunteer.click();
  await expect(page).toHaveURL(new RegExp(`/support-requests/${TARGET_REQUEST_ID}\\?mode=change-volunteer`));

  await page.getByRole("button", { name: "Change Volunteer", exact: true }).click();
  await expect(page).toHaveURL(/\/volunteer-lists\/?(?:\?.*)?$/);
  const replacementCard = page.locator("li").filter({ has: page.getByRole("heading", { name: replacementName, exact: true }) });
  await expect(replacementCard, `B2400843 profile ${replacementName} is not selectable in the volunteer directory. Check its skill and weekly availability against TCUC2_45.`).toBeVisible({ timeout: 60_000 });
  await replacementCard.getByRole("heading", { name: replacementName, exact: true }).click();
  await replacementCard.getByRole("button", { name: "Choose Volunteer" }).click();
  await expect(page).toHaveURL(new RegExp(`/support-requests/${TARGET_REQUEST_ID}\\?`));
  await expect(page.getByText(replacementName, { exact: true })).toBeVisible();
  const confirm = page.getByRole("button", { name: "Confirm New Volunteer", exact: true });
  await expect(confirm).toBeVisible();
  await confirm.click();

  const conflictAlert = page.getByRole("alert").filter({ hasText: CONFLICT_MESSAGE });
  await expect(conflictAlert, "Expected the appointment conflict message from the reassign API.").toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(new RegExp(`/support-requests/${TARGET_REQUEST_ID}\\?`));

  const { data: finalTarget, error: finalTargetError } = await db.from("support_request")
    .select("request_id,volunteer_id,status,assignment_version")
    .eq("request_id", TARGET_REQUEST_ID).eq("requester_id", studentSession.user.id).maybeSingle();
  expect(finalTargetError, `Could not verify TCUC2_45 after rejection: ${finalTargetError?.message ?? ""}`).toBeNull();
  expect(finalTarget, "TCUC2_45 must still exist after the rejected reassignment.").toMatchObject({
    request_id: TARGET_REQUEST_ID, volunteer_id: ORIGINAL_VOLUNTEER_ID, status: "Pending", assignment_version: 1,
  });
  const { count: targetCount, error: targetCountError } = await db.from("support_request")
    .select("request_id", { count: "exact", head: true }).eq("request_id", TARGET_REQUEST_ID).eq("requester_id", studentSession.user.id);
  expect(targetCountError, `Could not count TCUC2_45 after rejection: ${targetCountError?.message ?? ""}`).toBeNull();
  expect(targetCount, "Rejected reassignment must not create a duplicate request.").toBe(1);

  const { data: finalConflict, error: finalConflictError } = await db.from("support_request")
    .select("request_id,volunteer_id,status,requested_date,requested_time")
    .eq("request_id", CONFLICT_REQUEST_ID).maybeSingle();
  expect(finalConflictError, `Could not verify TCUC2_44 after rejection: ${finalConflictError?.message ?? ""}`).toBeNull();
  expect(finalConflict, "TCUC2_44 must remain Accepted and assigned to B2400843.").toMatchObject({
    request_id: CONFLICT_REQUEST_ID, volunteer_id: CONFLICT_VOLUNTEER_ID, status: "Accepted",
    requested_date: conflict!.requested_date, requested_time: conflict!.requested_time,
  });

  await evidence(page, "TCUC2_45");
});
