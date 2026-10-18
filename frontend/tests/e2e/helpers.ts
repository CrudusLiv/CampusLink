import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';

/** Where each case's screenshot is saved, named after its test case ID (for the "Actual Output" column). */
export const EVIDENCE_DIR = path.join(__dirname, 'evidence');

function readEnvLocal(): Record<string, string> {
  const text = readFileSync(path.join(__dirname, '..', '..', '.env.local'), 'utf8');
  return Object.fromEntries(
    text.split(/\r?\n/).filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
  );
}

/**
 * Signs in through the Supabase API and puts the session where the app looks for it.
 * (The login page needs an emailed code that a test cannot read, so the page is skipped.)
 */
export async function signIn(page: Page) {
  const email = process.env.CL_EMAIL;
  const password = process.env.CL_PW;
  if (!email || !password) throw new Error('Set CL_EMAIL and CL_PW to a test account before running the browser tests.');

  const env = readEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const { data, error } = await createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY).auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`Test login failed: ${error?.message}`);

  const key = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [key, JSON.stringify(data.session)]);
  return data.session;
}

/** Saves the evidence screenshot for one test case, hiding the Next.js dev badge first. */
export async function evidence(page: Page, testCaseId: string) {
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, `${testCaseId}.png`) });
}
