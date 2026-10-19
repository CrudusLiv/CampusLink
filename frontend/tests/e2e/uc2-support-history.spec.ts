import { expect, test } from "@playwright/test";
import { evidence, signInAs } from "./helpers";

test("TCUC2_42 views support request history as a student", async ({ page }) => {
  const volunteerEmail = process.env.CL_EMAIL;
  const volunteerPassword = process.env.CL_PW;
  const studentEmail = process.env.CL_STUDENT_EMAIL;
  const studentPassword = process.env.CL_STUDENT_PW;

  if (!volunteerEmail || !volunteerPassword || !studentEmail || !studentPassword) {
    throw new Error(
      "Set CL_EMAIL/CL_PW for the volunteer and CL_STUDENT_EMAIL/CL_STUDENT_PW for the student.",
    );
  }

  const volunteer = await signInAs(page, volunteerEmail, volunteerPassword);
  const student = await signInAs(page, studentEmail, studentPassword);

  if (volunteer.user.id === student.user.id) {
    throw new Error("The student and volunteer accounts must be different.");
  }

  const date = new Date();
  date.setDate(date.getDate() + 7);
  const requestedDate = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
  const title = `TCUC2_42 history request ${Date.now()}`;

  const response = await page.request.post("/api/support-requests", {
    headers: { Authorization: `Bearer ${student.access_token}` },
    data: {
      title,
      description: "Automated history test request.",
      category: "Programming",
      requested_date: requestedDate,
      requested_time: "10:00",
      support_mode: "Online",
      volunteer_id: volunteer.user.id,
      preferred_time: new Date(`${requestedDate}T10:00:00+08:00`).toISOString(),
    },
  });

  expect(response.status(), await response.text()).toBe(201);

  await signInAs(page, volunteerEmail, volunteerPassword);
  await page.goto("/volunteer/requests");

  const requestCard = page.locator("li").filter({ hasText: title });
  await expect(requestCard).toBeVisible({ timeout: 60_000 });
  await requestCard.getByRole("button", { name: "Accept" }).click();
  await expect(requestCard).toHaveCount(0);

  await signInAs(page, studentEmail, studentPassword);
  await page.goto("/support-history");

  const historyRow = page.getByRole("row").filter({ hasText: title });
  await expect(historyRow).toBeVisible({ timeout: 60_000 });
  await expect(historyRow).toContainText("Accepted");

  await evidence(page, "TCUC2_35");
});

test("TCUC2_43 views support request history as a volunteer", async ({ page }) => {
  const volunteerEmail = process.env.CL_EMAIL;
  const volunteerPassword = process.env.CL_PW;
  const studentEmail = process.env.CL_STUDENT_EMAIL;
  const studentPassword = process.env.CL_STUDENT_PW;

  if (!volunteerEmail || !volunteerPassword || !studentEmail || !studentPassword) {
    throw new Error("Set volunteer and student test account credentials first.");
  }

  const volunteer = await signInAs(page, volunteerEmail, volunteerPassword);
  const student = await signInAs(page, studentEmail, studentPassword);

  if (volunteer.user.id === student.user.id) {
    throw new Error("The student and volunteer accounts must be different.");
  }

  const date = new Date();
  date.setDate(date.getDate() + 7);
  const requestedDate = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
  const title = `TCUC2_43 history request ${Date.now()}`;

  const response = await page.request.post("/api/support-requests", {
    headers: { Authorization: `Bearer ${student.access_token}` },
    data: {
      title,
      description: "Automated volunteer history test request.",
      category: "Programming",
      requested_date: requestedDate,
      requested_time: "10:00",
      support_mode: "Online",
      volunteer_id: volunteer.user.id,
      preferred_time: new Date(`${requestedDate}T10:00:00+08:00`).toISOString(),
    },
  });

  expect(response.status(), await response.text()).toBe(201);

  await signInAs(page, volunteerEmail, volunteerPassword);
  await page.goto("/volunteer/requests");

  const requestCard = page.locator("li").filter({ hasText: title });
  await expect(requestCard).toBeVisible({ timeout: 60_000 });
  await requestCard.getByRole("button", { name: "Accept" }).click();
  await expect(requestCard).toHaveCount(0);

  await page.goto("/volunteer/history");

  const historyCard = page.locator("li").filter({ hasText: title });
  await expect(historyCard).toBeVisible({ timeout: 60_000 });
  await expect(historyCard).toContainText("Accepted");

  await evidence(page, "TCUC2_43");
});

test("TCUC2_44 shows the empty request history screen", async ({ page }) => {
  const studentEmail = process.env.CL_STUDENT_EMAIL;
  const studentPassword = process.env.CL_STUDENT_PW;

  if (!studentEmail || !studentPassword) {
    throw new Error("Set CL_STUDENT_EMAIL and CL_STUDENT_PW for the student test account.");
  }

  await signInAs(page, studentEmail, studentPassword);

  await page.route("**/rest/v1/support_request**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    });
  });

  await page.goto("/support-history");

  await expect(
    page.getByText("Your support requests will appear here.", { exact: true }),
  ).toBeVisible({ timeout: 60_000 });

  await evidence(page, "TCUC2_44");
});