import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { evidence, signIn } from './helpers';

// More use case 3 browser cases (TCUC3_26 to 30). They read the demo data from backend/supabase/seed-demo.sql and change nothing:
// the one click, Accept on a request with no bookable support mode, is expected to be refused.
// Case IDs match the Excel test sheet. Each screenshot is saved as tests/e2e/evidence/<ID><letter>.png.

test.describe.configure({ mode: 'serial' });

let page: Page;
let accessToken = '';
let userId = '';

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  const session = await signIn(page);
  accessToken = session.access_token;
  userId = session.user.id;
});
test.afterAll(async () => page.close());

const view = (v: 'student' | 'volunteer') => page.evaluate(([k, val]) => sessionStorage.setItem(k, val), [`campuslink:dashboard-view:${userId}`, v]);
async function settled() {
  await page.waitForLoadState('networkidle');
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 60_000 });
  await expect(page.getByText(/^Loading (your|session)/)).toHaveCount(0, { timeout: 60_000 });
}
async function openSession(title: string) {
  await page.goto('/sessions');
  await settled();
  await page.locator('a[href^="/sessions/"]', { hasText: title }).first().click();
  await page.waitForURL(/\/sessions\/[0-9a-f-]{36}/);
  await settled();
}
const api = async (qs: string) => (await (await page.request.get(`/api/sessions?${qs}`, { headers: { Authorization: `Bearer ${accessToken}` } })).json()).sessions as { requestTitle: string }[];

test('TCUC3_26 a session id that does not exist (or is not yours) shows a plain message and no controls', async () => {
  await page.goto('/sessions/00000000-0000-4000-8000-000000000000');
  await expect(page.getByText('We could not find this session.')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('button', { name: /Cancel session|Mark as completed|Submit feedback|Save/ })).toHaveCount(0);
  await evidence(page, 'TCUC3_26');
  const res = await page.request.get('/api/sessions?id=00000000-0000-4000-8000-000000000000', { headers: { Authorization: `Bearer ${accessToken}` } });
  expect((await res.json()).sessions).toEqual([]);
});

test('TCUC3_27 the Help Seeker sees no volunteer controls; the volunteer sees complete, cancel and join details', async () => {
  await view('student');
  await openSession('Debugging my Java project');
  await expect(page.getByRole('button', { name: 'Cancel session' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark as completed' })).toHaveCount(0);
  await expect(page.getByLabel(/Where or how to join/)).toHaveCount(0);
  await evidence(page, 'TCUC3_27a');

  await view('volunteer');
  await openSession('Intro to Git branches');
  await expect(page.getByRole('button', { name: 'Mark as completed' })).toBeDisabled(); // the session has not started
  await expect(page.getByRole('button', { name: 'Cancel session' })).toBeVisible();
  await expect(page.getByLabel(/Where or how to join/)).toBeVisible();
  await evidence(page, 'TCUC3_27b');
});

test('TCUC3_28 Accept on a request with no bookable support mode is refused and the request stays Pending', async () => {
  await view('volunteer');
  await page.goto('/volunteer/requests');
  await settled();
  const chat = page.locator('li', { hasText: 'SQL joins for assignment 2' });
  test.skip((await chat.count()) === 0, 'Needs the demo request "SQL joins for assignment 2" (mode Chat) to be Pending.');
  const before = (await api('status=Scheduled&upcoming=true')).length;
  await chat.getByRole('button', { name: 'Accept', exact: true }).click();
  await expect(page.getByText(/no support mode a session can be booked in/)).toBeVisible();
  await expect(chat).toHaveCount(1); // still in the Pending list
  await page.setViewportSize({ width: 1280, height: 1000 }); // tall enough to show the message and the request together
  await page.getByText(/no support mode a session can be booked in/).scrollIntoViewIfNeeded();
  await evidence(page, 'TCUC3_28');
  await page.setViewportSize({ width: 1280, height: 720 });
  expect((await api('status=Scheduled&upcoming=true')).length).toBe(before); // and no session was booked
});

test('TCUC3_29 the volunteer dashboard "Average rating" matches the rating summary the database returns', async () => {
  await view('volunteer');
  await page.goto('/dashboard');
  await settled();
  await expect(page.getByText('Average rating', { exact: true })).toBeVisible({ timeout: 60_000 });
  const tile = await page.evaluate(() => {
    const label = [...document.querySelectorAll('*')].find((el) => el.children.length === 0 && el.textContent?.trim() === 'Average rating');
    return Number(label?.closest('article')?.innerText.match(/\d+(\.\d+)?/)?.[0] ?? NaN);
  });
  const env = Object.fromEntries(readFileSync(path.join(__dirname, '..', '..', '.env.local'), 'utf8').split(/\r?\n/).filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
  const rpc = await page.request.post(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/volunteer_rating_summary`, {
    headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
    data: { p_volunteer_id: userId },
  });
  const summary = (await rpc.json()) as { average: number | null; count: number } | { average: number | null; count: number }[];
  const average = Array.isArray(summary) ? summary[0].average : summary.average;
  expect(average).not.toBeNull();
  expect(tile).toBeCloseTo(Number(average), 1);
  await evidence(page, 'TCUC3_29');
});

test('TCUC3_30 the dashboard "Upcoming Sessions" count matches the sessions the API returns for the Help Seeker', async () => {
  await view('student');
  await page.goto('/dashboard');
  await settled();
  await expect(page.getByText('Upcoming Sessions', { exact: true })).toBeVisible({ timeout: 60_000 });
  const tile = await page.evaluate(() => {
    const label = [...document.querySelectorAll('*')].find((el) => el.children.length === 0 && el.textContent?.trim() === 'Upcoming Sessions');
    return Number(label?.closest('article')?.innerText.match(/\d+/)?.[0] ?? NaN);
  });
  const fromApi = (await api('status=Scheduled&upcoming=true&role=student')).length;
  expect(tile).toBe(fromApi);
  await evidence(page, 'TCUC3_30');
});
