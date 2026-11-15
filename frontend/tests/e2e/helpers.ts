import { createClient } from '@supabase/supabase-js';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';

/** Where each case's screenshot is saved, named after its test case ID. */
export const EVIDENCE_DIR = path.join(__dirname, 'evidence');

function readEnvLocal(): Record<string, string> {
  const text = readFileSync(path.resolve(__dirname, '..', '..', '.env.local'), 'utf8');
  const env: Record<string, string> = {};

  for (const line of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([^=]+?)\s*=\s*(.*)\s*$/);
    if (!match) continue;

    const key = match[1].trim();
    let value = match[2].trim();
    if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }

  const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  const missing = required.filter((key) => !env[key]);
  if (missing.length) throw new Error(`Missing required .env.local variables: ${missing.join(', ')}`);
  return env;
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
