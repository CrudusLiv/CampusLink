import { expect, test, type Page } from '@playwright/test';
import { evidence, signIn } from './helpers';

// Use case 3: scheduling a support session (US1) and viewing upcoming sessions (US2).
// Case IDs match the Excel test sheet. Each screenshot is saved as tests/e2e/evidence/<ID><letter>.png.
// TCUC3_8 needs an accepted request between two people; without one it skips instead of failing.
// TCUC3_8 BOOKS a real session in the project database, so clean up afterwards (see the README).

test.describe.configure({ mode: 'serial' });

let page: Page;
let accessToken = '';

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  accessToken = (await signIn(page)).access_token;
});
test.afterAll(async () => page.close());

/** Waits until nothing on the page is still loading, so the screenshot shows the finished screen. */
async function settled() {
  await page.waitForLoadState('networkidle');
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 60_000 });
  await expect(page.getByText(/^Loading your/)).toHaveCount(0, { timeout: 60_000 });
}

test('TCUC3_8 schedule a session: free slots and modes, confirmation, and a refused double booking', async () => {
  await page.goto('/sessions');
  await settled();
  const buttons = page.getByRole('link', { name: 'Schedule session' });
  test.skip((await buttons.count()) < 2, 'Needs two accepted requests between the same two people (test data).');
  const ids = await buttons.evaluateAll((as) => as.map((a) => new URL((a as HTMLAnchorElement).href).searchParams.get('requestId') ?? ''));

  // 8a: the form offers the volunteer's free slots and the three modes
  await page.goto(`/sessions/schedule?requestId=${ids[0]}`);
  const times = page.locator('[aria-label^="Choose a time"] button');
  await expect(times.first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByLabel('In-Person')).toBeVisible();
  await expect(page.getByLabel('Chat')).toBeVisible();
  await page.getByLabel('Online').check();
  await expect(page.locator('#meetingLink')).toBeVisible();
  await evidence(page, 'TCUC3_8a');

  // 8b: confirming shows the summary with both participants
  await times.first().click();
  await page.locator('#meetingLink').fill('https://meet.google.com/abc-defg-hij');
  await page.getByRole('button', { name: /Confirm Support Session/ }).click();
  await expect(page.getByText('Support Session scheduled')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/\(Help Seeker\)/)).toBeVisible();
  await expect(page.getByText(/\(Volunteer\)/)).toBeVisible();
  await evidence(page, 'TCUC3_8b');
  const list = await page.request.get('/api/sessions?status=Scheduled&upcoming=true', { headers: { Authorization: `Bearer ${accessToken}` } });
  const bookedIso: string = (await list.json()).sessions[0].scheduledDatetime;

  // 8c: even if the screen still offers the booked time (two people at once), the server refuses it
  await page.route('**/api/sessions/schedule-context**', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.slots = [bookedIso];
    await route.fulfill({ response, json: body });
  });
  await page.goto(`/sessions/schedule?requestId=${ids[1]}`);
  await page.locator('[aria-label^="Choose a time"] button').first().click();
  await page.getByLabel('Chat').check();
  await page.getByRole('button', { name: /Confirm Support Session/ }).click();
  await expect(page.getByText('That time is no longer available, please pick a different time')).toBeVisible({ timeout: 60_000 });
  await evidence(page, 'TCUC3_8c');
  await page.unroute('**/api/sessions/schedule-context**');
});

test('TCUC3_9 upcoming sessions appear on the student and volunteer dashboards, and volunteers can reach My Support Sessions', async () => {
  await page.goto('/dashboard');
  await expect(page.locator('#dash-upcoming-title')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('section[aria-labelledby="dash-upcoming-title"] a', { hasText: 'View all' })).toHaveAttribute('href', '/sessions');
  await settled();
  await page.locator('#dash-upcoming-title').scrollIntoViewIfNeeded();
  await evidence(page, 'TCUC3_9a');

  await page.goto('/profile', { waitUntil: 'networkidle' });
  const toVolunteer = page.getByRole('button', { name: 'Volunteer', exact: true });
  await toVolunteer.waitFor({ timeout: 15_000 }).catch(() => undefined);
  test.skip((await toVolunteer.count()) === 0, 'This account is not a volunteer.');
  await toVolunteer.click();
  await page.waitForURL('**/dashboard');
  await expect(page.locator('#dash-upcoming-title')).toBeVisible({ timeout: 60_000 });
  await settled();
  await page.locator('#dash-upcoming-title').scrollIntoViewIfNeeded();
  await evidence(page, 'TCUC3_9b');

  await expect(page.locator('aside nav a', { hasText: 'My Sessions' })).toHaveAttribute('href', '/sessions');
  await page.locator('aside nav').getByRole('link', { name: 'My Sessions', exact: true }).click();
  await page.waitForURL('**/sessions');
  await settled();
  await expect(page.locator('aside')).toContainText(/Volunteer/i);
  await evidence(page, 'TCUC3_9c');
  // No need to switch back: the next page.goto reloads the app, which starts in the student view again.
});

test('TCUC3_10 empty, loading, error and no-request screens', async () => {
  // 10a empty
  await page.goto('/sessions?state=empty');
  await expect(page.getByText('No upcoming support sessions')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/schedule a session/i)).toBeVisible();
  await evidence(page, 'TCUC3_10a');

  // 10b loading: hold the response back so the placeholders stay on screen
  await page.route('**/api/sessions**', async (route) => {
    await new Promise((r) => setTimeout(r, 5000));
    await route.continue().catch(() => undefined);
  });
  await page.goto('/sessions', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[aria-busy="true"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('aside nav')).toBeVisible();
  await evidence(page, 'TCUC3_10b');
  await page.unroute('**/api/sessions**');

  // 10c error
  await page.goto('/sessions?state=error');
  await expect(page.getByText("We couldn't load your support sessions")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  await evidence(page, 'TCUC3_10c');

  // 10d schedule page without a request
  await page.goto('/sessions/schedule');
  await expect(page.getByText('Nothing to schedule here')).toBeVisible({ timeout: 60_000 });
  await evidence(page, 'TCUC3_10d');
});
