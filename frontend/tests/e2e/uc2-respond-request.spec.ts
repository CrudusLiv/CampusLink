import { expect, test } from "@playwright/test";
import { evidence, signIn, signInAs } from "./helpers";

test("TCUC2_27 accepts a pending support request", async ({ page }) => {
  const volunteerEmail = process.env.CL_EMAIL;
  const volunteerPassword = process.env.CL_PW;
  const studentEmail = process.env.CL_STUDENT_EMAIL;
  const studentPassword = process.env.CL_STUDENT_PW;

  if (!volunteerEmail || !volunteerPassword || !studentEmail || !studentPassword) {
    throw new Error("Set CL_EMAIL/CL_PW for the volunteer and CL_STUDENT_EMAIL/CL_STUDENT_PW for the student test account.");
  }

  const volunteerSession = await signInAs(page, volunteerEmail, volunteerPassword);
  const studentSession = await signInAs(page, studentEmail, studentPassword);

  if (volunteerSession.user.id === studentSession.user.id) {
    throw new Error("The student and volunteer test accounts must be different accounts.");
  }

  const requestedDateValue = new Date();
  requestedDateValue.setDate(requestedDateValue.getDate() + 7);
  const requestedDate = [
    requestedDateValue.getFullYear(),
    String(requestedDateValue.getMonth() + 1).padStart(2, "0"),
    String(requestedDateValue.getDate()).padStart(2, "0"),
  ].join("-");
  const title = `TCUC2_20 E2E request ${Date.now()}`;
  const preferredTime = new Date(`${requestedDate}T10:00:00+08:00`).toISOString();

  const createResponse = await page.request.post("/api/support-requests", {
    headers: { Authorization: `Bearer ${studentSession.access_token}` },
    data: {
      title,
      description: "Automated E2E test request.",
      category: "Programming",
      requested_date: requestedDate,
      requested_time: "10:00",
      support_mode: "Online",
      volunteer_id: volunteerSession.user.id,
      preferred_time: preferredTime,
    },
  });

  expect(
    createResponse.status(),
    `Creating the Pending test request failed: ${await createResponse.text()}`,
  ).toBe(201);

  await signInAs(page, volunteerEmail, volunteerPassword);
  await page.goto("/volunteer/requests");

  const requestCard = page.locator("li").filter({ hasText: title });
  await expect(requestCard).toBeVisible({ timeout: 60_000 });
  await requestCard.getByRole("button", { name: "Accept" }).click();
  await expect(requestCard).toHaveCount(0);

  await page.goto("/volunteer/history");
  const historyCard = page.locator("li").filter({ hasText: title });
  await expect(historyCard).toContainText("Accepted");

  await evidence(page, "TCUC2_27");
});

test("TCUC2_28 declines a pending support request", async ({ page }) => {
  const volunteerEmail = process.env.CL_EMAIL;
  const volunteerPassword = process.env.CL_PW;
  const studentEmail = process.env.CL_STUDENT_EMAIL;
  const studentPassword = process.env.CL_STUDENT_PW;

  if (!volunteerEmail || !volunteerPassword || !studentEmail || !studentPassword) {
    throw new Error("Set CL_EMAIL/CL_PW for the volunteer and CL_STUDENT_EMAIL/CL_STUDENT_PW for the student test account.");
  }

  const volunteerSession = await signInAs(page, volunteerEmail, volunteerPassword);
  const studentSession = await signInAs(page, studentEmail, studentPassword);

  if (volunteerSession.user.id === studentSession.user.id) {
    throw new Error("The student and volunteer test accounts must be different accounts.");
  }

  const requestedDateValue = new Date();
  requestedDateValue.setDate(requestedDateValue.getDate() + 7);
  const requestedDate = [
    requestedDateValue.getFullYear(),
    String(requestedDateValue.getMonth() + 1).padStart(2, "0"),
    String(requestedDateValue.getDate()).padStart(2, "0"),
  ].join("-");
  const title = `TCUC2_21 E2E request ${Date.now()}`;
  const preferredTime = new Date(`${requestedDate}T10:00:00+08:00`).toISOString();

  const createResponse = await page.request.post("/api/support-requests", {
    headers: { Authorization: `Bearer ${studentSession.access_token}` },
    data: {
      title,
      description: "Automated E2E test request.",
      category: "Programming",
      requested_date: requestedDate,
      requested_time: "10:00",
      support_mode: "Online",
      volunteer_id: volunteerSession.user.id,
      preferred_time: preferredTime,
    },
  });

  expect(
    createResponse.status(),
    `Creating the Pending test request failed: ${await createResponse.text()}`,
  ).toBe(201);

  await signInAs(page, volunteerEmail, volunteerPassword);
  await page.goto("/volunteer/requests");

  const requestCard = page.locator("li").filter({ hasText: title });
  await expect(requestCard).toBeVisible({ timeout: 60_000 });
  await requestCard.getByRole("button", { name: "Decline" }).click();
  await expect(requestCard).toHaveCount(0);

  await page.goto("/volunteer/history");
  const historyCard = page.locator("li").filter({ hasText: title });
  await expect(historyCard).toContainText("Declined");

  await evidence(page, "TCUC2_28");
});

test("TCUC2_29 shows the empty incoming-requests screen", async ({ page }) => {
  await signIn(page);
  await page.goto("/volunteer/requests");

  await expect(
    page.getByText("No incoming requests.", { exact: true })
  ).toBeVisible({ timeout: 60_000 });

  await evidence(page, "TCUC2_29");
});
