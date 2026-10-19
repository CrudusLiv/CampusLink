import { expect, test } from "@playwright/test";
import { evidence, signInAs } from "./helpers";

test("TCUC2_25 displays volunteers matching the request category and schedule", async ({ page }) => {
  const studentEmail = process.env.CL_STUDENT_EMAIL;
  const studentPassword = process.env.CL_STUDENT_PW;

  if (!studentEmail || !studentPassword) {
    throw new Error("Set CL_STUDENT_EMAIL and CL_STUDENT_PW for the student test account.");
  }

  await signInAs(page, studentEmail, studentPassword);

  const date = new Date();
  date.setDate(date.getDate() + ((2 - date.getDay() + 7) % 7 || 7));

  const requestedDate = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");

  const requestedDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()];
  const volunteerId = "a1b2c3d4-0002-4000-8000-000000000002";

  await page.route("**/rest/v1/volunteer_profile**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ user_id: volunteerId, skills: ["Programming"] }]),
    }),
  );

    await page.route("**/rest/v1/users**", async (route) => {
    const userFilter = new URL(route.request().url()).searchParams.get("user_id") ?? "";

    if (!userFilter.includes(volunteerId)) {
        await route.continue();
        return;
    }

    await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{
        user_id: volunteerId,
        name: "Matched Volunteer",
        photo_url: null,
        }]),
    });
    });
    await page.route("**/rest/v1/availability**", (route) =>
        route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{
            user_id: volunteerId,
            day_of_week: requestedDay,
            start_time: "10:00:00",
            end_time: "12:00:00",
        }]),
        }),
    );

  await page.goto("/sessions/ask-for-support");
  await page.getByRole("button", { name: "Programming", exact: true }).click();
  await page.locator('input[type="date"]').fill(requestedDate);
  await page.locator('input[type="time"]').fill("10:30");
  await page.getByRole("button", { name: "Auto-Match" }).click();

  await expect(page.getByText("Matched Volunteer", { exact: true })).toBeVisible();
  await expect(page.getByText("Matching volunteers (up to 3)")).toBeVisible();

  await evidence(page, "TCUC2_25");
});

test("TCUC2_26 shows when no volunteers match the request", async ({ page }) => {
  const studentEmail = process.env.CL_STUDENT_EMAIL;
  const studentPassword = process.env.CL_STUDENT_PW;

  if (!studentEmail || !studentPassword) {
    throw new Error("Set CL_STUDENT_EMAIL and CL_STUDENT_PW for the student test account.");
  }

  await signInAs(page, studentEmail, studentPassword);

  await page.route("**/rest/v1/volunteer_profile**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    }),
  );

  const date = new Date();
  date.setDate(date.getDate() + ((2 - date.getDay() + 7) % 7 || 7));
  const requestedDate = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");

  await page.goto("/sessions/ask-for-support");
  await page.getByRole("button", { name: "Programming", exact: true }).click();
  await page.locator('input[type="date"]').fill(requestedDate);
  await page.locator('input[type="time"]').fill("10:30");
  await page.getByRole("button", { name: "Auto-Match" }).click();

  await expect(
    page.getByText("No volunteers match your selected category and availability.", {
      exact: true,
    }),
  ).toBeVisible();

  await evidence(page, "TCUC2_26");
});