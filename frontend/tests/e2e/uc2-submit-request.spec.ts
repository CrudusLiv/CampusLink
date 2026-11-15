import { expect, test, type Page } from "@playwright/test";
import { evidence, signIn } from "./helpers";

const API_PATH = "/api/support-requests";
const VOLUNTEER_PROFILE_PATH = "**/rest/v1/volunteer_profile**";
const AVAILABILITY_PATH = "**/rest/v1/availability**";

function klDateOffset(days: number, now = new Date()) {
  const kl = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  kl.setUTCDate(kl.getUTCDate() + days);
  return `${kl.getUTCFullYear()}-${String(kl.getUTCMonth() + 1).padStart(2, "0")}-${String(kl.getUTCDate()).padStart(2, "0")}`;
}

function weekdayForKlDate(date: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" })
    .format(new Date(`${date}T12:00:00+08:00`));
}

async function selectVolunteer(page: Page) {
  await page.getByRole("button", { name: "Choose Volunteer" }).click();
  // The directory exposes its loaded count in this live region; cards render after loading completes.
  await expect(page.locator("main [aria-live='polite']").first()).toHaveText(/^\d+ volunteers?$/, { timeout: 60_000 });
  const cards = page.locator("li > div[role='button'][aria-pressed]");
  for (let index = 0; index < await cards.count(); index++) {
    const card = cards.nth(index);
    if ((await card.locator('[aria-label="Skills"]').innerText()) === "Skills not set") continue;
    await card.click();
    const makeRequest = page.getByRole("button", { name: "Make a request" });
    if (await makeRequest.isEnabled()) {
      await makeRequest.click();
      await expect(page.getByPlaceholder("Request Title")).toBeVisible();
      return true;
    }
  }
  return false;
}

async function openFormWithVolunteer(page: Page) {
  await page.goto("/sessions/ask-for-support");
  return selectVolunteer(page);
}

async function openFormWithVolunteerAndAvailableSlot(page: Page) {
  await page.goto("/sessions/ask-for-support");
  const profilesResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === "/rest/v1/volunteer_profile"
      && (url.searchParams.get("select") ?? "").includes("user_id")
      && (url.searchParams.get("select") ?? "").includes("skills");
  });
  const usersResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === "/rest/v1/users" && (url.searchParams.get("select") ?? "").includes("name");
  });
  const availabilityResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === "/rest/v1/availability"
      && (url.searchParams.get("select") ?? "").includes("user_id");
  });

  await page.getByRole("button", { name: "Choose Volunteer" }).click();
  const [profileRows, userRows, availabilityRows] = await Promise.all([
    profilesResponse.then((response) => response.json()) as Promise<{ user_id: string; skills: string[] | null }[]>,
    usersResponse.then((response) => response.json()) as Promise<{ user_id: string; name: string }[]>,
    availabilityResponse.then((response) => response.json()) as Promise<{ user_id: string; day_of_week: string; start_time: string; end_time: string }[]>,
  ]);
  await expect(page.locator("main [aria-live='polite']").first()).toHaveText(/^\d+ volunteers?$/, { timeout: 60_000 });

  const weekdayIndex: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const today = klDateOffset(0);
  const dayOffset = (weekday: string) => {
    const difference = (weekdayIndex[weekday] - weekdayIndex[weekdayForKlDate(today)] + 7) % 7;
    return difference || 7;
  };
  const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
  const cards = page.locator("li > div[role='button'][aria-pressed]");

  for (let index = 0; index < await cards.count(); index++) {
    const card = cards.nth(index);
    const name = (await card.locator("h2").innerText()).trim();
    const user = userRows.find((row) => row.name === name);
    const profile = profileRows.find((row) => row.user_id === user?.user_id);
    if (!user || !(profile?.skills?.length)) continue;

    const matchingSlot = availabilityRows
      .filter((slot) => slot.user_id === user.user_id)
      .find((slot) => minutes(slot.start_time) + 60 <= minutes(slot.end_time));
    if (!matchingSlot) continue;

    await card.click();
    const makeRequest = page.getByRole("button", { name: "Make a request" });
    if (!(await makeRequest.isEnabled())) continue;
    await makeRequest.click();
    await expect(page.getByPlaceholder("Request Title")).toBeVisible();
    return {
      requestedDate: klDateOffset(dayOffset(matchingSlot.day_of_week)),
      requestedTime: matchingSlot.start_time.slice(0, 5),
    };
  }
  return null;
}

async function fillRequest(page: Page, title: string, date = klDateOffset(1), time = "15:00") {
  const category = new URL(page.url()).searchParams.get("category");
  if (category) await page.getByRole("button", { name: category, exact: true }).click();
  await page.getByPlaceholder("Request Title").fill(title);
  await page.getByPlaceholder("Description").fill("E2E test support request.");
  await page.getByLabel("Preferred date").fill(date);
  await page.getByLabel("Preferred time").fill(time);
  await page.getByRole("button", { name: "Online", exact: true }).click();
}

function observePosts(page: Page) {
  const posts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === API_PATH) posts.push(request.url());
  });
  return posts;
}

async function mockVolunteerChecks(page: Page, category: string, slots: () => unknown[]) {
  await page.route(VOLUNTEER_PROFILE_PATH, (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ skills: [category] }),
  }));
  await page.route(AVAILABILITY_PATH, (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(slots()),
  }));
}

test("TCUC2_5 submits a valid request and shows it as Pending in My Support Requests", async ({ page }) => {
  await signIn(page);
  const availableSlot = await openFormWithVolunteerAndAvailableSlot(page);
  test.skip(!availableSlot, "Needs a listed volunteer with a skill and a future one-hour availability slot.");
  const title = `TCUC2_5 request ${Date.now()}`;
  await fillRequest(page, title, availableSlot!.requestedDate, availableSlot!.requestedTime);
  const apiResponsePromise = page.waitForResponse((response) => new URL(response.url()).pathname === API_PATH, { timeout: 15_000 }).catch(() => null);
  await page.getByRole("button", { name: "Submit request" }).click();

  const apiResponse = await apiResponsePromise;
  const apiBody = apiResponse ? await apiResponse.json().catch(() => null) : null;
  const formErrors = await page.locator("form p[role='alert']").allTextContents();
  const diagnostic = `Form errors: ${JSON.stringify(formErrors)}; API status: ${apiResponse?.status() ?? "no response"}; API body: ${JSON.stringify(apiBody)}`;
  expect(apiResponse?.status(), diagnostic).toBe(201);
  expect(apiBody, diagnostic).toEqual({ success: true });

  await expect(page, diagnostic).toHaveURL(/\/support-requests\?submitted=1$/);
  await expect(page.getByRole("status")).toContainText("Your support request was submitted successfully.");
  const row = page.getByRole("row").filter({ hasText: title });
  await expect(row).toBeVisible({ timeout: 60_000 });
  await expect(row).toContainText("Pending");
  await evidence(page, "TCUC2_5");
});

test("TCUC2_6 shows required-field feedback and prevents submission", async ({ page }) => {
  await signIn(page);
  await page.goto("/sessions/ask-for-support");
  const posts = observePosts(page);

  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page.locator("form").getByText("Please select a category.", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/sessions\/ask-for-support$/);
  expect(posts).toHaveLength(0);

  await page.getByRole("button", { name: "Programming", exact: true }).click();
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page.locator("form").getByText("Please fill out this field.", { exact: true })).toBeVisible();
  expect(posts).toHaveLength(0);
  await evidence(page, "TCUC2_6");
});

test("TCUC2_7 displays feedback when the selected time is less than one hour away", async ({ page }) => {
  await signIn(page);
  test.skip(!(await openFormWithVolunteer(page)), "Needs an eligible volunteer with at least one skill.");

  // Freeze at 08:00 Kuala Lumpur time, then derive the date from the frozen clock.
  await page.clock.install({ time: new Date(`${klDateOffset(0)}T08:00:00+08:00`) });
  const today = await page.evaluate(() => {
    const kl = new Date(Date.now() + 8 * 60 * 60 * 1000);
    return `${kl.getUTCFullYear()}-${String(kl.getUTCMonth() + 1).padStart(2, "0")}-${String(kl.getUTCDate()).padStart(2, "0")}`;
  });
  const category = new URL(page.url()).searchParams.get("category") ?? "";
  await mockVolunteerChecks(page, category, () => [{
    day_of_week: weekdayForKlDate(today), start_time: "00:00:00", end_time: "23:59:00",
  }]);
  await fillRequest(page, "TCUC2_7 soon request", today, "08:30");
  const posts = observePosts(page);
  await page.route(`**${API_PATH}`, (route) => route.fulfill({
    status: 400,
    contentType: "application/json",
    body: JSON.stringify({
      error: "validation",
      message: "Choose a time at least 1 hour from now.",
      fields: { requested_time: "Choose a time at least 1 hour from now." },
    }),
  }));
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page.locator("form").getByText("Choose a time at least 1 hour from now.", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/sessions\/ask-for-support/);
  expect(posts).toHaveLength(1);
  await expect(page.getByRole("status")).toHaveCount(0);
  await evidence(page, "TCUC2_7");
});

test("TCUC2_8 shows feedback when volunteer skills or availability do not match", async ({ page }) => {
  await signIn(page);
  test.skip(!(await openFormWithVolunteer(page)), "Needs an eligible volunteer with at least one skill.");
  const category = new URL(page.url()).searchParams.get("category") ?? "";
  const requestDate = klDateOffset(1);
  const weekday = weekdayForKlDate(requestDate);
  let profileLookups = 0;
  let availabilityLookups = 0;

  await page.route(VOLUNTEER_PROFILE_PATH, (route) => {
    profileLookups++;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ skills: profileLookups === 1 ? [] : [category] }),
    });
  });
  await page.route(AVAILABILITY_PATH, (route) => {
    availabilityLookups++;
    const slots = availabilityLookups === 1
      ? [{ day_of_week: weekday, start_time: "14:00:00", end_time: "17:00:00" }]
      : availabilityLookups === 2
        ? []
        : [{ day_of_week: weekday, start_time: "14:00:00", end_time: "15:30:00" }];
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(slots) });
  });
  const posts = observePosts(page);
  await fillRequest(page, "TCUC2_8 mismatch request", requestDate, "15:00");

  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page.locator("form").getByText("The selected category does not match this volunteer's skills.", { exact: true })).toBeVisible();
  expect(posts).toHaveLength(0);

  await page.getByLabel("Preferred date").fill(requestDate);
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page.locator("form").getByText("This volunteer is not available on the selected date.", { exact: true })).toBeVisible();
  expect(posts).toHaveLength(0);

  await page.getByLabel("Preferred date").fill(requestDate);
  await page.getByLabel("Preferred time").fill("15:00");
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page.locator("form").getByText("This volunteer is not available at the selected time.", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/sessions\/ask-for-support/);
  expect(posts).toHaveLength(0);
  await expect(page.getByRole("status")).toHaveCount(0);
  await evidence(page, "TCUC2_8");
});

test("TCUC2_9 displays feedback when the volunteer has an accepted request at that time", async ({ page }) => {
  await signIn(page);
  test.skip(!(await openFormWithVolunteer(page)), "Needs an eligible volunteer with at least one skill.");
  const category = new URL(page.url()).searchParams.get("category") ?? "";
  const requestDate = klDateOffset(1);
  await mockVolunteerChecks(page, category, () => [{
    day_of_week: weekdayForKlDate(requestDate), start_time: "00:00:00", end_time: "23:59:00",
  }]);
  await fillRequest(page, "TCUC2_9 conflict request", requestDate, "15:00");
  const posts = observePosts(page);
  const conflictMessage = "This volunteer already has a request. Please choose a time after 04:00 PM.";
  await page.route(`**${API_PATH}`, (route) => route.fulfill({
    status: 400,
    contentType: "application/json",
    body: JSON.stringify({ error: "validation", message: conflictMessage, fields: { requested_time: conflictMessage } }),
  }));
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page.locator("form").getByText(conflictMessage, { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/sessions\/ask-for-support/);
  expect(posts).toHaveLength(1);
  await expect(page.getByRole("status")).toHaveCount(0);
  await evidence(page, "TCUC2_9");
});
