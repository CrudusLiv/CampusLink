import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { evidence, signInAs } from "./helpers";

const REQUEST_ID = "5e7019d8-5fea-4843-b328-6a56f796047f";
const STUDENT_EMAIL = "b2400541@helplive.edu.my";
const ORIGINAL_VOLUNTEER_EMAIL = "b2400857@helplive.edu.my";
const REPLACEMENT_VOLUNTEER_EMAIL = "b2400843@helplive.edu.my";

function credentials(email: string, passwordVariable: string) {
  const password = process.env[passwordVariable];
  if (!password) {
    throw new Error(`TCUC2_44 requires ${passwordVariable} in the test environment for ${email}. Passwords are not stored in the test.`);
  }
  return password;
}

function publicSupabaseConfig() {
  const envPath = path.join(__dirname, "..", "..", ".env.local");
  const env = Object.fromEntries(readFileSync(envPath, "utf8").split(/\r?\n/)
    .filter((line) => line.includes("="))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1).trim()]));
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("TCUC2_44 requires the existing public Supabase URL and anon key in frontend/.env.local.");
  }
  return env as Record<string, string>;
}

test("TCUC2_44 successfully changes the volunteer on an overdue Pending request", async ({ page }) => {
  const studentPassword = credentials(STUDENT_EMAIL, "CL_STUDENT_PW");
  const originalVolunteerPassword = credentials(ORIGINAL_VOLUNTEER_EMAIL, "CL_ORIGINAL_VOLUNTEER_PW");
  const replacementVolunteerPassword = credentials(REPLACEMENT_VOLUNTEER_EMAIL, "CL_REPLACEMENT_VOLUNTEER_PW");

  const replacementSession = await signInAs(page, REPLACEMENT_VOLUNTEER_EMAIL, replacementVolunteerPassword);
  const studentSession = await signInAs(page, STUDENT_EMAIL, studentPassword);
  const env = publicSupabaseConfig();
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${studentSession.access_token}` } },
  });
  const { data: target, error: targetError } = await db.from("support_request")
    .select("request_id,title,volunteer_id,status,assignment_version")
    .eq("request_id", REQUEST_ID).eq("requester_id", studentSession.user.id).maybeSingle();
  expect(targetError, `Could not read the fixed request through the student's permitted session: ${targetError?.message ?? ""}`).toBeNull();
  expect(target, `Fixed request ${REQUEST_ID} is missing or is not owned by ${STUDENT_EMAIL}.`).not.toBeNull();
  expect(target).toMatchObject({ volunteer_id: expect.any(String), status: "Pending", assignment_version: 1 });
  const requestTitle = target!.title;
  const { data: replacementProfile, error: replacementProfileError } = await db.from("users")
    .select("name").eq("user_id", replacementSession.user.id).maybeSingle();
  expect(replacementProfileError, `Could not resolve replacement volunteer profile through the student's permitted session: ${replacementProfileError?.message ?? ""}`).toBeNull();
  expect(replacementProfile?.name, `Replacement volunteer ${REPLACEMENT_VOLUNTEER_EMAIL} has no visible directory profile.`).toBeTruthy();
  const replacementName = replacementProfile!.name;
  const { data: originalProfile, error: originalProfileError } = await db.from("users")
    .select("name").eq("user_id", target!.volunteer_id).maybeSingle();
  expect(originalProfileError, `Could not resolve original volunteer profile through the student's permitted session: ${originalProfileError?.message ?? ""}`).toBeNull();
  expect(originalProfile?.name, `Original volunteer ${ORIGINAL_VOLUNTEER_EMAIL} has no visible profile.`).toBeTruthy();
  const originalName = originalProfile!.name;

  await page.goto("/support-requests");

  await expect(page.getByRole("heading", { name: "My Support Requests" })).toBeVisible({ timeout: 60_000 });
  const visibleRows = page.getByRole("row")
    .filter({ has: page.getByRole("cell", { name: requestTitle, exact: true }) })
    .filter({ hasText: "Pending" });
  await expect(visibleRows, `Request ${REQUEST_ID} (${requestTitle}) was not found uniquely in My Support Requests for ${STUDENT_EMAIL}.`).toHaveCount(1, { timeout: 60_000 });

  const actions = visibleRows.getByRole("button", { name: /Actions/ });
  await expect(visibleRows.locator('[aria-label="No response for 24 hours"]'), `Overdue notification prerequisite missing for request ${REQUEST_ID}; scheduled notification must exist before TCUC2_44.`).toBeVisible({ timeout: 10_000 });
  await actions.click();
  const changeVolunteer = page.getByRole("menuitem", { name: /Change Volunteer/ });
  await expect(changeVolunteer, `Change Volunteer is unavailable for ${REQUEST_ID}; verify the overdue notification was generated and is current for this assignment.`).toBeVisible();
  await changeVolunteer.click();

  await expect(page).toHaveURL(new RegExp(`/support-requests/${REQUEST_ID}\\?mode=change-volunteer`));
  await page.getByRole("button", { name: "Change Volunteer", exact: true }).click();
  await expect(page).toHaveURL(/\/volunteer-lists\/?(?:\?.*)?$/);
  const replacementCard = page.locator("li").filter({ has: page.getByRole("heading", { name: replacementName, exact: true }) });
  await expect(replacementCard, `Replacement volunteer account ${REPLACEMENT_VOLUNTEER_EMAIL} is not available in the volunteer directory.`).toBeVisible({ timeout: 60_000 });
  await replacementCard.getByRole("heading", { name: replacementName, exact: true }).click();
  await replacementCard.getByRole("button", { name: "Choose Volunteer" }).click();
  await expect(page).toHaveURL(new RegExp(`/support-requests/${REQUEST_ID}\\?`));
  const confirm = page.getByRole("button", { name: "Confirm New Volunteer", exact: true });
  await expect(confirm).toBeVisible();
  await confirm.click();
  await expect(page).toHaveURL(/\/support-requests\?volunteerChanged=1$/);
  await expect(page.getByRole("heading", { name: "My Support Requests" })).toBeVisible();
  await expect(page.getByText("Volunteer Changed Successfully!", { exact: true })).toBeVisible({ timeout: 30_000 });

  const reassignedRow = page.getByRole("row")
    .filter({ has: page.getByRole("cell", { name: requestTitle, exact: true }) })
    .filter({ hasText: "Pending" });
  await expect(reassignedRow).toBeVisible({ timeout: 60_000 });
  await expect(reassignedRow).toContainText("Pending");
  await expect(reassignedRow).toContainText(replacementName);
  await expect(reassignedRow).not.toContainText(originalName);

  await evidence(page, "TCUC2_44");

  await signInAs(page, ORIGINAL_VOLUNTEER_EMAIL, originalVolunteerPassword);
  await page.goto("/volunteer/requests");
  await expect(page.getByRole("heading", { name: "Incoming Requests" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("listitem").filter({ hasText: requestTitle })).toHaveCount(0, { timeout: 60_000 });

  await signInAs(page, REPLACEMENT_VOLUNTEER_EMAIL, replacementVolunteerPassword);
  await page.goto("/volunteer/requests");
  const replacementRequest = page.getByRole("listitem").filter({ hasText: requestTitle });
  await expect(replacementRequest).toBeVisible({ timeout: 60_000 });
  await expect(replacementRequest).toContainText(requestTitle);
  await expect(replacementRequest.getByRole("button", { name: /^(Accept|Not available)$/ })).toBeVisible();
  await expect(replacementRequest.getByRole("button", { name: "Decline" })).toBeVisible();

  const { data: finalRequest, error: finalError } = await db.from("support_request")
    .select("request_id,volunteer_id,status,assignment_version")
    .eq("request_id", REQUEST_ID).eq("requester_id", studentSession.user.id).maybeSingle();
  expect(finalError, `Could not verify final request state through the student's permitted session: ${finalError?.message ?? ""}`).toBeNull();
  expect(finalRequest).toMatchObject({ request_id: REQUEST_ID, volunteer_id: replacementSession.user.id, status: "Pending", assignment_version: 2 });
  const { count: requestCount, error: countError } = await db.from("support_request").select("request_id", { count: "exact", head: true }).eq("requester_id", studentSession.user.id).eq("request_id", REQUEST_ID);
  expect(countError).toBeNull();
  expect(requestCount, "Reassignment must preserve the existing single request without duplicates.").toBe(1);

});
