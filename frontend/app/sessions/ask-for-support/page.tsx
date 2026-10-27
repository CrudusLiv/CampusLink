import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import { SubmitRequestForm } from '@/app/sessions/SubmitRequestForm';
import s from '@/components/sessions/sessions.module.css';

export const metadata: Metadata = { title: 'Submit Request | CampusLink' };

export default async function AskForSupportPage() {
  return (
    <AppShell title="Submit Requests">
      <main className={s.content}>
        <p>
          <Link className={s.backLink} href="/dashboard">
            ← Back to Dashboard
          </Link>
        </p>
        <Suspense fallback={null}>
          <SubmitRequestForm />
        </Suspense>
      </main>
    </AppShell>
  );
}