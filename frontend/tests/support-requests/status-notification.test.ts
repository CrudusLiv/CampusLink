import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveVolunteerResponse } from '@/lib/support-requests/volunteer-requests';

const REQUEST_ID = 'a1b2c3d4-0004-4000-8000-000000000004';
const STUDENT_ID = 'a1b2c3d4-0001-4000-8000-000000000001';
const VOLUNTEER_ID = 'a1b2c3d4-0002-4000-8000-000000000002';
const NEW_VOLUNTEER_ID = 'a1b2c3d4-0003-4000-8000-000000000003';

function makeQuery() {
  const query = {
    update: vi.fn(),
    eq: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn(),
  };
  query.update.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.select.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({ data: { request_id: REQUEST_ID }, error: null });
  return query;
}

const migration = async (name: string) => readFile(
  resolve(dirname(fileURLToPath(import.meta.url)), `../../../backend/supabase/migrations/${name}`),
  'utf8',
);

describe('TCUC2_50 - Volunteer accepts a Pending support request', () => {
  let query: ReturnType<typeof makeQuery>;
  let db: Parameters<typeof saveVolunteerResponse>[0];

  beforeEach(() => {
    vi.resetAllMocks();
    query = makeQuery();
    db = { from: vi.fn(() => query) } as unknown as Parameters<typeof saveVolunteerResponse>[0];
  });

  it('TCUC2_50 - Updates Pending to Accepted and defines a Student notification', async () => {
    const result = await saveVolunteerResponse(db, REQUEST_ID, VOLUNTEER_ID, 'Accepted');
    expect(db.from).toHaveBeenCalledWith('support_request');
    expect(query.update).toHaveBeenCalledWith({ status: 'Accepted' });
    expect(query.eq).toHaveBeenCalledWith('request_id', REQUEST_ID);
    expect(query.eq).toHaveBeenCalledWith('volunteer_id', VOLUNTEER_ID);
    expect(query.eq).toHaveBeenCalledWith('status', 'Pending');
    expect(result).toEqual({ saved: true });

    const sql = await migration('20261029000300_realtime_notifications.sql');
    expect(sql).toMatch(/old\.status::text\s*=\s*'Pending'[\s\S]*?new\.status::text\s+in\s*\('Accepted',\s*'Declined',\s*'Cancelled'\)/i);
    expect(sql).toMatch(/v_recipient\s*:=\s*new\.requester_id[\s\S]*?when\s+'Accepted'\s+then\s+'request_accepted'/i);
    expect(sql).toMatch(/insert\s+into\s+public\.notification\s*\(user_id,\s*type,\s*message,\s*event_key\)/i);
  });
});

describe('TCUC2_51 - Volunteer declines a Pending support request', () => {
  let query: ReturnType<typeof makeQuery>;
  let db: Parameters<typeof saveVolunteerResponse>[0];

  beforeEach(() => {
    vi.resetAllMocks();
    query = makeQuery();
    db = { from: vi.fn(() => query) } as unknown as Parameters<typeof saveVolunteerResponse>[0];
  });

  it('TCUC2_51 - Updates Pending to Declined and defines a Student notification', async () => {
    const result = await saveVolunteerResponse(db, REQUEST_ID, VOLUNTEER_ID, 'Declined');
    expect(query.update).toHaveBeenCalledWith({ status: 'Declined' });
    expect(query.eq).toHaveBeenCalledWith('request_id', REQUEST_ID);
    expect(query.eq).toHaveBeenCalledWith('volunteer_id', VOLUNTEER_ID);
    expect(query.eq).toHaveBeenCalledWith('status', 'Pending');
    expect(result).toEqual({ saved: true });

    const sql = await migration('20261029000300_realtime_notifications.sql');
    expect(sql).toMatch(/old\.status::text\s*=\s*'Pending'[\s\S]*?new\.status::text\s+in\s*\('Accepted',\s*'Declined',\s*'Cancelled'\)/i);
    expect(sql).toMatch(/v_recipient\s*:=\s*new\.requester_id[\s\S]*?when\s+'Declined'\s+then\s+'request_declined'/i);
    expect(sql).toMatch(/insert\s+into\s+public\.notification\s*\(user_id,\s*type,\s*message,\s*event_key\)/i);
  });
});

describe('TCUC2_52 - Handle database update failure', () => {
  let query: ReturnType<typeof makeQuery>;
  let db: Parameters<typeof saveVolunteerResponse>[0];

  beforeEach(() => {
    vi.resetAllMocks();
    query = makeQuery();
    db = { from: vi.fn(() => query) } as unknown as Parameters<typeof saveVolunteerResponse>[0];
  });

  it('TCUC2_52 - Returns failure when the database update fails', async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: { message: 'Database unavailable' } });
    const result = await saveVolunteerResponse(db, REQUEST_ID, VOLUNTEER_ID, 'Accepted');
    expect(query.update).toHaveBeenCalledWith({ status: 'Accepted' });
    expect(result).toEqual({ saved: false });
  });
});

describe('TCUC2_53 - Handle volunteer non-response', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('TCUC2_53 - Defines a 24-hour Pending reminder and permits Student reassignment', async () => {
    const sql = await migration('20261114000100_volunteer_response_reminders.sql');
    expect(sql).toMatch(/where\s+r\.status::text\s*=\s*'Pending'[\s\S]*?and\s+r\.volunteer_id\s+is\s+not\s+null[\s\S]*?r\.volunteer_assigned_at\s+<=\s+now\(\)\s*-\s*interval\s+'24 hours'/i);
    expect(sql).toMatch(/select\s+r\.requester_id,\s*'request_no_response'/i);
    expect(sql).toMatch(/request_no_response[\s\S]*?r\.assignment_version/i);
    expect(sql).toMatch(/add column if not exists volunteer_assigned_at[\s\S]*?add column if not exists assignment_version/i);
    expect(sql).toMatch(/create or replace function public\.reassign_pending_support_request\([\s\S]*?v_request\.status::text\s*<>\s*'Pending'[\s\S]*?update public\.support_request set volunteer_id\s*=\s*p_new_volunteer_id/i);
    expect(sql).toMatch(/v_request\.requester_id\s*<>\s*v_caller[\s\S]*?REQUEST_NOT_OWNED/i);
    expect(sql).toMatch(/p_new_volunteer_id\s+is\s+null[\s\S]*?INVALID_VOLUNTEER/i);

    const route = await readFile(
      resolve(dirname(fileURLToPath(import.meta.url)), '../../app/api/support-requests/[id]/reassign/route.ts'),
      'utf8',
    );
    expect(route).toMatch(/export\s+async\s+function\s+POST/);
    expect(route).toMatch(/\.eq\("status",\s*"Pending"\)/);
    expect(route).toMatch(/reassign_pending_support_request/);
    expect(route).toMatch(/expectedVolunteerId[\s\S]*?volunteerId/);
  });
});
