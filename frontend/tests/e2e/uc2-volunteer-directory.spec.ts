import { expect, test } from "@playwright/test";
import { evidence, signIn } from "./helpers";

test("TCUC2_10 searches volunteers by name", async ({ page }) => {
  await signIn(page);
  await page.goto("/volunteer-lists");

  const volunteerCards = page.locator("li[aria-pressed]");
  await expect(volunteerCards.first()).toBeVisible({ timeout: 60_000 });

  const volunteerName = await volunteerCards.first().locator("h2").innerText();

  await page.getByPlaceholder("Search volunteers").fill(volunteerName);

  await expect(
    page.getByRole("heading", { name: volunteerName, exact: true })
  ).toBeVisible();

  expect(await volunteerCards.count()).toBeGreaterThan(0);

  await evidence(page, "TCUC2_10");
});

test("TCUC2_15 filters volunteers by skill", async ({ page }) => {
  await signIn(page);
  await page.goto("/volunteer-lists");

  const volunteerCards = page.locator("li[aria-pressed]");
  await expect(volunteerCards.first()).toBeVisible({ timeout: 60_000 });

  let skill = "";

  for (let i = 0; i < await volunteerCards.count(); i++) {
    const badges = volunteerCards.nth(i).locator('[aria-label="Skills"] span');

    if (await badges.count() > 0) {
      const firstSkill = (await badges.first().innerText()).trim();

      if (firstSkill && firstSkill !== "Skills not set") {
        skill = firstSkill;
        break;
      }
    }
  }

  test.skip(!skill, "No volunteer with a listed skill is available for this test.");

  await page.locator("label").filter({ hasText: "All skills" }).locator("select").selectOption({ label: skill });

  await expect(volunteerCards.first()).toBeVisible();

  for (let i = 0; i < await volunteerCards.count(); i++) {
    await expect(
      volunteerCards
        .nth(i)
        .locator('[aria-label="Skills"]')
        .getByText(skill, { exact: true })
    ).toBeVisible();
  }

  await evidence(page, "TCUC2_15");
});

test("TCUC2_16 filters volunteers by faculty", async ({ page }) => {
  await signIn(page);
  await page.goto("/volunteer-lists");

  const volunteerCards = page.locator("li[aria-pressed]");
  await expect(volunteerCards.first()).toBeVisible({ timeout: 60_000 });

  let faculty = "";

  for (let i = 0; i < await volunteerCards.count(); i++) {
    const firstParagraph = volunteerCards.nth(i).locator("p").first();

    if (await firstParagraph.count()) {
      const text = (await firstParagraph.innerText()).trim();

      if (text && !text.startsWith("Available:")) {
        faculty = text;
        break;
      }
    }
  }

  test.skip(!faculty, "No volunteer with a faculty is available for this test.");

  await page.locator("label").filter({ hasText: "All faculties" }).locator("select").selectOption({ label: faculty });

  await expect(volunteerCards.first()).toBeVisible();

  for (let i = 0; i < await volunteerCards.count(); i++) {
    await expect(volunteerCards.nth(i).locator("p").first()).toHaveText(faculty);
  }

  await evidence(page, "TCUC2_16");
});

test("TCUC2_17 filters volunteers by requested weekday and time", async ({ page }) => {
  await signIn(page);
  await page.goto("/volunteer-lists");

  let volunteerName = "";
  let day = "";
  let time = "";

  const volunteerCards = page.locator("li[aria-pressed]");
  await expect(volunteerCards.first()).toBeVisible({ timeout: 60_000 });

  for (let i = 0; i < await volunteerCards.count(); i++) {
    const card = volunteerCards.nth(i);
    if (!(await card.getByText(/^Available:/).count())) continue;

    volunteerName = await card.locator("h2").innerText();
    await card.click();
    await page.getByRole("button", { name: "View volunteer profile" }).click();

    const slots = page.locator("aside ul li");
    await expect(slots.first()).toBeVisible();

    for (let j = 0; j < await slots.count(); j++) {
      const match = (await slots.nth(j).innerText())
        .match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun):.*?(\d{2}:\d{2})[–-](\d{2}:\d{2})/);

      if (match) {
        day = match[1];
        time = match[2];
        break;
      }
    }

    if (day && time) break;
    await page.goto("/volunteer-lists");
    await expect(volunteerCards.first()).toBeVisible({ timeout: 60_000 });
  }

  test.skip(!volunteerName || !day || !time, "No volunteer with a readable availability slot is available.");

  await page.goto(`/volunteer-lists?day=${day}&time=${time}`);
  await expect(page.getByRole("heading", { name: volunteerName, exact: true })).toBeVisible();

  await evidence(page, "TCUC2_17");
});

test("TCUC2_18 combines directory filters", async ({ page }) => {
  await signIn(page);
  await page.goto("/volunteer-lists");

  const volunteerCards = page.locator("li[aria-pressed]");
  await expect(volunteerCards.first()).toBeVisible({ timeout: 60_000 });

  let name = "";
  let skill = "";
  let faculty = "";

  for (let i = 0; i < await volunteerCards.count(); i++) {
    const card = volunteerCards.nth(i);
    const badges = card.locator('[aria-label="Skills"] span');
    const firstParagraph = card.locator("p").first();

    if (!(await badges.count()) || !(await firstParagraph.count())) continue;

    const candidateSkill = (await badges.first().innerText()).trim();
    const candidateFaculty = (await firstParagraph.innerText()).trim();

    if (
      candidateSkill &&
      candidateSkill !== "Skills not set" &&
      candidateFaculty &&
      !candidateFaculty.startsWith("Available:")
    ) {
      name = await card.locator("h2").innerText();
      skill = candidateSkill;
      faculty = candidateFaculty;
      break;
    }
  }

  test.skip(!name, "No volunteer with both a listed skill and faculty is available.");

  await page.getByPlaceholder("Search volunteers").fill(name);
  await page.locator("label").filter({ hasText: "All skills" }).locator("select").selectOption({ label: skill });
  await page.locator("label").filter({ hasText: "All faculties" }).locator("select").selectOption({ label: faculty });

  const matchingCard = volunteerCards.filter({
    has: page.getByRole("heading", { name, exact: true }),
  });

  await expect(matchingCard).toBeVisible();
  await expect(matchingCard.locator('[aria-label="Skills"]')).toContainText(skill);
  await expect(matchingCard.locator("p").first()).toHaveText(faculty);

  await evidence(page, "TCUC2_18");
});

test("TCUC2_19 shows no matching volunteers", async ({ page }) => {
  await signIn(page);
  await page.goto("/volunteer-lists");

  await page.getByPlaceholder("Search volunteers").fill("no-volunteer-match-xyz");

  await expect(
    page.getByRole("heading", { name: "No volunteers match those filters" })
  ).toBeVisible();

  await evidence(page, "TCUC2_19");
});