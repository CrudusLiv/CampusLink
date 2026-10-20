import { expect, test, type Page } from '@playwright/test';
import { evidence, signIn } from './helpers';

// Use case 3: scheduling a support session (US1) and viewing upcoming sessions (US2).
// Case IDs match the Excel test sheet. Each screenshot is saved as tests/e2e/evidence/<ID><letter>.png.
// TCUC3_8 ACCEPTS a real request, which books a session in the project database: reset the test data before a re-run (see the README).

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

test('TCUC3_8 accepting a request books the session at the requested time; a busy or unavailable time is blocked; a booked time is refused', async () => {
  // Test data (see the README): request 1 is Pending for a free time, request 2 is Pending for a time the volunteer is
  // not available, request 4 is Accepted with no session yet. Skips, not fails, when the data is not in that state.
  await page.goto('/volunteer/requests');
  await settled();
  const free = page.locator('li', { hasText: 'Sessions test: Java help' });
  const blocked = page.locator('li', { hasText: 'Sessions test: SQL joins' });
  test.skip((await free.count()) === 0, 'Needs the Pending test request "Java help" assigned to this volunteer.');

  // 8a: Accept is offered for a free time and blocked ("Not available") for a time outside the availability
  await expect(free.getByRole('button', { name: 'Accept' })).toBeEnabled();
  await expect(blocked.getByRole('button', { name: 'Not available' })).toBeDisabled();
  await evidence(page, 'TCUC3_8a');

  // 8b: Accept books the session straight away, at the time the requester chose, without a Schedule step
  await free.getByRole('button', { name: 'Accept' }).click();
  await expect(free).toHaveCount(0, { timeout: 60_000 });
  await page.goto('/sessions');
  await settled();
  const booked = page.getByText('Sessions test: Java help').first();
  await expect(booked).toBeVisible();
  await booked.scrollIntoViewIfNeeded();
  await expect(page.locator('a[href*="b1b2c3d4-0001"]')).toHaveCount(0); // request 1 no longer waits for a time
  await evidence(page, 'TCUC3_8b');
  const list = await page.request.get('/api/sessions?status=Scheduled&upcoming=true', { headers: { Authorization: `Bearer ${accessToken}` } });
  const bookedIso: string = (await list.json()).sessions[0].scheduledDatetime;
  expect(bookedIso).toBe('2026-10-26T02:00:00.000Z'); // 10:00 Kuala Lumpur

  // 8c: the manual form is the fallback; even if it still offers the booked time (two people at once), the server refuses it
  const requestId = 'b1b2c3d4-0004-4000-8000-000000000004';
  await expect(page.locator(`a[href*="${requestId}"]`)).toBeVisible();
  await page.route('**/api/sessions/schedule-context**', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.slots = [bookedIso];
    await route.fulfill({ response, json: body });
  });
  await page.goto(`/sessions/schedule?requestId=${requestId}`);
  await page.locator('[aria-label^="Choose a time"] button').first().click();
  await page.getByLabel('Chat').check();
  await page.getByRole('button', { name: /Confirm Support Session/ }).click();
  await expect(page.getByText('That time is no longer available, please pick a different time')).toBeVisible({ timeout: 60_000 });
  await evidence(page, 'TCUC3_8c');
  await page.unroute('**/api/sessions/schedule-context**');

  // 8d: the manual form still books a session, and it is the only way to add a meeting link
  await page.goto(`/sessions/schedule?requestId=${requestId}`);
  await page.locator('[aria-label^="Choose a time"] button').first().click();
  await page.getByLabel('Online').check();
  await page.locator('#meetingLink').fill('https://meet.google.com/abc-defg-hij');
  await page.getByRole('button', { name: /Confirm Support Session/ }).click();
  await expect(page.getByText('Support Session scheduled')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/\(Help Seeker\)/)).toBeVisible();
  await expect(page.getByText(/\(Volunteer\)/)).toBeVisible();
  await evidence(page, 'TCUC3_8d');
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

// System test case ST-SCH-02 (invalid input on the schedule form): 02a no time, 02b insecure link, 02c request not accepted.
// Nothing is saved: the form's own validation stops the first two before any request is sent, and the third only
// opens a page. The test checks that no booking request reaches the server.
test('ST-SCH-02 invalid input on the schedule form: no time, insecure link, request not accepted', async () => {
  await page.setViewportSize({ width: 1280, height: 900 }); // tall enough to show an error under the form
  let bookingRequests = 0;
  page.on('request', (r) => {
    if (r.method() === 'POST' && new URL(r.url()).pathname === '/api/sessions') bookingRequests++;
  });

  // Needs an accepted request that has no session yet (test data); skip, don't fail, without one.
  await page.goto('/sessions');
  await settled();
  const waiting = page.getByRole('link', { name: 'Schedule session' });
  test.skip((await waiting.count()) === 0, 'Needs an accepted request still waiting for a time (test data).');
  const requestId = new URL((await waiting.first().getAttribute('href')) ?? '', page.url()).searchParams.get('requestId');

  // ST-SCH-02a: a mode is chosen but no time
  await page.goto(`/sessions/schedule?requestId=${requestId}`);
  await expect(page.locator('[aria-label^="Choose a time"] button').first()).toBeVisible({ timeout: 60_000 });
  await page.getByLabel('Chat').check();
  await page.getByRole('button', { name: /Confirm Support Session/ }).click();
  // exact: the heading "1. Pick a date and time" contains the same words
  const noTime = page.getByText('Pick a date and time', { exact: true });
  await expect(noTime).toBeVisible();
  await noTime.scrollIntoViewIfNeeded();
  await evidence(page, 'ST-SCH-02a');

  // ST-SCH-02b: a time and Online chosen, with an http:// link
  await page.goto(`/sessions/schedule?requestId=${requestId}`);
  await page.locator('[aria-label^="Choose a time"] button').first().click();
  await page.getByLabel('Online').check();
  await page.locator('#meetingLink').fill('http://insecure.example');
  await page.getByRole('button', { name: /Confirm Support Session/ }).click();
  const badLink = page.getByText('Meeting link must be a valid https:// link');
  await expect(badLink).toBeVisible();
  await badLink.scrollIntoViewIfNeeded();
  await evidence(page, 'ST-SCH-02b');

  // ST-SCH-02c: a request that is not accepted (the Pending test request; any unknown id looks the same)
  await page.goto('/sessions/schedule?requestId=b1b2c3d4-0003-4000-8000-000000000003');
  await expect(page.getByText('Nothing to schedule here')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[aria-label^="Choose a time"]')).toHaveCount(0);
  await evidence(page, 'ST-SCH-02c');

  expect(bookingRequests).toBe(0);
});
