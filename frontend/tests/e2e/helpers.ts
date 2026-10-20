import { createClient } from '@supabase/supabase-js';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';

/** Where each case's screenshot is saved, named after its test case ID. */
export const EVIDENCE_DIR = path.join(__dirname, 'evidence');

function readEnvLocal(): Record<string, string> {
  const text = readFileSync(path.join(__dirname, '..', '..', '.env.local'), 'utf8');
  return Object.fromEntries(
    text.split(/\r?\n/).filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
  );
}

/** Signs in as the given account and installs its Supabase session in the browser. */
export async function signInAs(page: Page, email: string, password: string) {
  const env = readEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const { data, error } = await createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY).auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`Test login failed for ${email}: ${error?.message}`);

  const key = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [key, JSON.stringify(data.session)]);
  return data.session;
}

/** Uses the default account for existing E2E tests. */
export async function signIn(page: Page) {
  const email = process.env.CL_EMAIL;
  const password = process.env.CL_PW;
  if (!email || !password) throw new Error('Set CL_EMAIL and CL_PW to a test account before running the browser tests.');
  return signInAs(page, email, password);
}

/** Saves the evidence screenshot for one test case. */
export async function evidence(page: Page, testCaseId: string) {
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
  await page.waitForTimeout(250);
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCE_DIR, `${testCaseId}.png`) });
}
