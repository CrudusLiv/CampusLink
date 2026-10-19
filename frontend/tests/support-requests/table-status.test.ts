import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const tableSource = await readFile(new URL('../../app/support-requests/SupportRequestsTable.tsx', import.meta.url), 'utf8');
const historySource = await readFile(new URL('../../app/support-history/SupportHistoryTable.tsx', import.meta.url), 'utf8');
const studentHistorySource = await readFile( new URL("../../lib/support-requests/student-history.ts", import.meta.url), "utf8",);

describe('My Support Requests status data and badges', () => {
  it('loads the current request status from the signed-in requester’s database rows', () => {
    expect(tableSource).toMatch(/\.from\("support_request"\)/);
    expect(tableSource).toMatch(/\.select\([^\n]*\bstatus\b/);
    expect(tableSource).toMatch(/\.eq\("requester_id",\s*profile!?\.user_id\)/);
    expect(tableSource).toMatch(/status:\s*row\.status as SupportRequestStatus/);
  });

  it('shows the shared status badge and keeps cancellation persisted in the database', () => {
    expect(tableSource).toMatch(/<RequestStatusBadge status=\{request\.status\}\s*\/>/);
    expect(tableSource).toMatch(/\.update\(\{\s*status:\s*"Cancelled"\s*\}\)/);
    expect(tableSource).toMatch(/\.eq\("status",\s*"Pending"\)/);
  });

  it('removes Completed from the Support Requests filter while retaining the live status badge', () => {
    expect(tableSource).toMatch(/const FILTERS = \["All", "Pending", "Accepted", "Cancelled", "Declined"\]/);
    expect(tableSource).not.toMatch(/const FILTERS = \[[^\]]*"Completed"/);
    expect(tableSource).toMatch(/<RequestStatusBadge status=\{request\.status\}\s*\/>/);
  });

  it('keeps Completed in the Support History database query and filter, but removes Pending and Accepted filters', () => {
    expect(historySource).toMatch(/const FILTERS = \["All", "Completed", "Cancelled", "Declined"\]/);
    expect(historySource).not.toMatch(/const FILTERS = \[[^\]]*"Pending"/);
    expect(historySource).not.toMatch(/const FILTERS = \[[^\]]*"Accepted"/);
    expect(historySource).toMatch(/\.in\("status", \[\.\.\.query\.statuses\]\)/);
    expect(historySource).toMatch(/aria-label="Filter support history by status"/);
    expect(historySource).toMatch(/statusFilter === "All" \|\| row\.status === statusFilter/);
    expect(historySource).toMatch(/const matchesSearch = !term/);
    expect(historySource.indexOf('id="support-history-search"')).toBeLessThan(historySource.indexOf('Filter support history by status'));
  });

  it("TCUC2_37 sorts support history by date, newest first", () => {
    expect(studentHistorySource).toMatch(
      /\.order\("requested_date",\s*\{\s*ascending:\s*false\s*\}\)/,
    );
  });
});
