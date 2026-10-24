import { expect, test } from "@playwright/test";
import { evidence, signIn } from "./helpers";

test("TCUC2_8 submits a support request through the student form", async ({ page }) => {
  await signIn(page);
  await page.goto("/sessions/ask-for-support");

  await page.getByRole("button", { name: "Choose Volunteer" }).click();

  const volunteerCards = page.locator("li[aria-pressed]");
  await expect(volunteerCards.first()).toBeVisible({ timeout: 60_000 });

  let selectedVolunteer = false;

  for (let i = 0; i < await volunteerCards.count(); i++) {
    const card = volunteerCards.nth(i);
    const skills = await card.locator('[aria-label="Skills"]').innerText();

    if (skills === "Skills not set") continue;

    await card.click();

    const makeRequestButton = page.getByRole("button", { name: "Make a request" });
    if (await makeRequestButton.isEnabled()) {
      await makeRequestButton.click();
      selectedVolunteer = true;
      break;
    }
  }

  test.skip(!selectedVolunteer, "Needs an eligible volunteer with at least one skill.");

  const title = `E2E request ${Date.now()}`;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const requestDate = [
    tomorrow.getFullYear(),
    String(tomorrow.getMonth() + 1).padStart(2, "0"),
    String(tomorrow.getDate()).padStart(2, "0"),
  ].join("-");

  await page.getByPlaceholder("Request Title").fill(title);
  await page.getByPlaceholder("Description").fill("E2E test support request.");
  await page.locator('input[type="date"]').fill(requestDate);
  await page.locator('input[type="time"]').fill("15:00");
  await page.getByRole("button", { name: "Online", exact: true }).click();
  await page.getByRole("button", { name: "Submit request" }).click();

  await expect(page).toHaveURL(/\/support-requests\?submitted=1$/);
  await expect(page.getByText("Your support request was submitted successfully.", { exact: true })).toBeVisible();

  const requestRow = page.getByRole("row").filter({ hasText: title });
  await expect(requestRow).toBeVisible({ timeout: 60_000 });
  await expect(requestRow).toContainText("Pending");

  await evidence(page, "TCUC2_8");
});

test("TCUC2_9 shows validation feedback when the request category is missing", async ({ page }) => {
  await signIn(page);
  await page.goto("/sessions/ask-for-support");

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const requestDate = [
    tomorrow.getFullYear(),
    String(tomorrow.getMonth() + 1).padStart(2, "0"),
    String(tomorrow.getDate()).padStart(2, "0"),
  ].join("-");

  await page.getByPlaceholder("Request Title").fill("E2E validation test");
  await page.getByPlaceholder("Description").fill("Testing missing request category.");
  await page.locator('input[type="date"]').fill(requestDate);
  await page.locator('input[type="time"]').fill("15:00");

  let requestPosts = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/api/support-requests"
    ) {
      requestPosts++;
    }
  });

  await page.getByRole("button", { name: "Submit request" }).click();

  await expect(page.locator('p[role="alert"]')).toHaveText("Please select a category.");
  await expect(page).toHaveURL(/\/sessions\/ask-for-support$/);
  expect(requestPosts).toBe(0);

  await evidence(page, "TCUC2_9");
});
