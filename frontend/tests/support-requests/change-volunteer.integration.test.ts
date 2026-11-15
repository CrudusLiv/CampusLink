import { beforeEach, describe, expect, it, vi } from 'vitest';

const authenticate = vi.fn();

vi.mock('@/lib/sessions/api', async (original) => ({
  ...(await original<typeof import('@/lib/sessions/api')>()),
  authenticate: (...args: unknown[]) => authenticate(...args),
}));

const { POST } = await import('@/app/api/support-requests/[id]/reassign/route');

const REQUESTER = 'a1b2c3d4-0001-4000-8000-000000000001';
const ORIGINAL_VOLUNTEER = 'a1b2c3d4-0002-4000-8000-000000000002';
const NEW_VOLUNTEER = 'a1b2c3d4-0003-4000-8000-000000000003';
const REQUEST_ID = 'a1b2c3d4-0004-4000-8000-000000000004';

type RequestRecord = {
  request_id: string;
  requester_id: string;
  volunteer_id: string;
  status: 'Pending' | 'Accepted' | 'Declined' | 'Completed' | 'Cancelled';
  category: string;
  requested_date: string;
  requested_time: string;
  preferred_time: string;
  title: string;
  assignment_version: number;
  volunteer_assigned_at: string;
};

type NotificationRecord = {
  user_id: string;
  type: string;
  message: string;
  event_key: string;
  request_id: string;
};

const INITIAL_REQUEST: RequestRecord = {
  request_id: REQUEST_ID,
  requester_id: REQUESTER,
  volunteer_id: ORIGINAL_VOLUNTEER,
  status: 'Pending',
  category: 'Programming',
  requested_date: '2026-12-07',
  requested_time: '15:00:00',
  preferred_time: '2026-12-07T07:00:00.000Z',
  title: 'Programming help',
  assignment_version: 3,
  volunteer_assigned_at: '2026-11-01T00:00:00.000Z',
};

let requestRecord: RequestRecord;
let notifications: NotificationRecord[];
let databaseError: { code: string; message: string } | null;
let observedClock: string;
let from: ReturnType<typeof vi.fn>;
let rpc: ReturnType<typeof vi.fn>;
let acceptedTimes: { requested_time: string }[];

function createDb() {
  const maybeSingle = vi.fn(async () => ({
    data: {
      category: requestRecord.category,
      requested_date: requestRecord.requested_date,
      requested_time: requestRecord.requested_time,
    },
    error: null,
  }));
  const select = vi.fn(() => query);
  const eq = vi.fn(() => query);
  const query = { select, eq, maybeSingle };
  from = vi.fn((table: string) => {
    if (table === 'support_request') return query;
    if (table === 'volunteer_profile') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: { skills: ['Programming'], is_volunteer: true }, error: null })),
          })),
        })),
      };
    }
    if (table === 'availability') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({
            data: [{ day_of_week: 'Mon', start_time: '14:00:00', end_time: '17:00:00' }],
            error: null,
          })),
        })),
      };
    }
    throw new Error(`Unexpected table access: ${table}`);
  });
  rpc = vi.fn(async (name: string, args: Record<string, string>) => {
    if (name === 'get_volunteer_accepted_times') {
      return { data: acceptedTimes, error: null };
    }
    if (name !== 'reassign_pending_support_request') throw new Error(`Unexpected RPC: ${name}`);
    if (databaseError) return { data: null, error: databaseError };

    // Model the atomic RPC boundary: update, assignment tracking, and notification
    // either all commit or none do. PostgreSQL itself is not exercised here.
    const nextRequest = {
      ...requestRecord,
      volunteer_id: args.p_new_volunteer_id,
      assignment_version: requestRecord.assignment_version + 1,
      volunteer_assigned_at: observedClock,
    };
    const nextNotification: NotificationRecord = {
      user_id: args.p_new_volunteer_id,
      type: 'request_pending',
      message: `You received a new support request: "${requestRecord.title}".`,
      event_key: `request:${requestRecord.request_id}:assignment:${nextRequest.assignment_version}`,
      request_id: requestRecord.request_id,
    };
    requestRecord = nextRequest;
    notifications = [...notifications, nextNotification];
    return { data: nextRequest.assignment_version, error: null };
  });
  return { from, rpc };
}

function postReassignment() {
  return POST(
    new Request(`http://localhost/api/support-requests/${REQUEST_ID}/reassign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
      body: JSON.stringify({ expectedVolunteerId: ORIGINAL_VOLUNTEER, volunteerId: NEW_VOLUNTEER }),
    }),
    { params: Promise.resolve({ id: REQUEST_ID }) },
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  requestRecord = { ...INITIAL_REQUEST };
  notifications = [];
  databaseError = null;
  acceptedTimes = [];
  observedClock = '2026-11-15T04:00:00.000Z';
  const db = createDb();
  authenticate.mockResolvedValue({ me: { id: REQUESTER }, db });
});

describe('TCUC2_41 successfully reassigns a volunteer', () => {
  it('TCUC2_41 successfully reassigns a volunteer and creates an assignment notification', async () => {
    const originalVersion = requestRecord.assignment_version;
    const originalAssignedAt = requestRecord.volunteer_assigned_at;

    const response = await postReassignment();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, assignmentVersion: originalVersion + 1 });
    expect(rpc).toHaveBeenCalledWith('reassign_pending_support_request', {
      p_request_id: REQUEST_ID,
      p_expected_volunteer_id: ORIGINAL_VOLUNTEER,
      p_new_volunteer_id: NEW_VOLUNTEER,
    });
    expect(rpc).toHaveBeenCalledWith('get_volunteer_accepted_times', {
      p_volunteer_id: NEW_VOLUNTEER,
      p_requested_date: INITIAL_REQUEST.requested_date,
    });
    expect(requestRecord).toMatchObject({
      volunteer_id: NEW_VOLUNTEER,
      status: 'Pending',
      assignment_version: originalVersion + 1,
      volunteer_assigned_at: observedClock,
    });
    expect(requestRecord.volunteer_assigned_at).not.toBe(originalAssignedAt);
    expect(notifications).toEqual([{
      user_id: NEW_VOLUNTEER,
      type: 'request_pending',
      message: 'You received a new support request: "Programming help".',
      event_key: `request:${REQUEST_ID}:assignment:${originalVersion + 1}`,
      request_id: REQUEST_ID,
    }]);
  });
});

describe('TCUC2_42 rejects reassignment with appointment conflict', () => {
  it('TCUC2_42 rejects reassignment when the volunteer has an overlapping Accepted request', async () => {
    acceptedTimes = [{ requested_time: '15:30:00' }];
    const before = { ...requestRecord };

    const response = await postReassignment();

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: 'conflict',
      message: 'The selected volunteer already has an accepted request at this time. Choose another available volunteer.',
    });
    expect(rpc).toHaveBeenCalledWith('get_volunteer_accepted_times', {
      p_volunteer_id: NEW_VOLUNTEER,
      p_requested_date: before.requested_date,
    });
    expect(rpc).not.toHaveBeenCalledWith('reassign_pending_support_request', expect.anything());
    expect(requestRecord).toEqual(before);
    expect(notifications).toEqual([]);
  });
});

describe('TCUC2_43 handles reassignment failure', () => {
  it('TCUC2_43 returns an error without changing the request or creating a notification when the RPC fails', async () => {
    databaseError = { code: 'XX000', message: 'simulated database failure' };
    const before = { ...requestRecord };

    const response = await postReassignment();

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      error: 'unknown',
      message: "We couldn't change the volunteer. Please try again.",
    });
    expect(rpc).toHaveBeenCalledWith('reassign_pending_support_request', {
      p_request_id: REQUEST_ID,
      p_expected_volunteer_id: ORIGINAL_VOLUNTEER,
      p_new_volunteer_id: NEW_VOLUNTEER,
    });
    expect(requestRecord).toEqual(before);
    expect(notifications).toEqual([]);
  });
});
