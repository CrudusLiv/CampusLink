import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const historySource = await readFile(new URL('../../app/support-history/SupportHistoryTable.tsx', import.meta.url), 'utf8');
const studentHistorySource = await readFile(new URL('../../lib/support-requests/student-history.ts', import.meta.url), 'utf8');

describe('TCUC2_29 filters support history by final status', () => {
  it('filters support history by final status', () => {
    expect(historySource).toMatch(/const FILTERS = \["All", "Completed", "Cancelled", "Declined"\]/);
    expect(historySource).not.toMatch(/const FILTERS = \[[^\]]*"Pending"/);
    expect(historySource).not.toMatch(/const FILTERS = \[[^\]]*"Accepted"/);
    expect(studentHistorySource).toMatch(/\.in\("status", \[\.\.\.query\.statuses\]\)/);
    expect(historySource).toMatch(/aria-label="Filter support history by status"/);
    expect(historySource).toMatch(/statusFilter === "All" \|\| row\.status === statusFilter/);
  });
});

describe('TCUC2_30 sorts support history by date, newest first', () => {
  it('sorts support history by date, newest first', () => {
    expect(studentHistorySource).toMatch(
      /\.order\("requested_date",\s*\{\s*ascending:\s*false\s*\}\)/,
    );
  });
});
