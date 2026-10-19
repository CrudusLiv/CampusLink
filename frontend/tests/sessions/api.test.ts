import { beforeEach, describe, expect, it, vi } from 'vitest';

// The database layer is mocked: these tests cover the HTTP behaviour of the routes only.
const authenticate = vi.fn();
const getAcceptedRequest = vi.fn();
const createSession = vi.fn();
const listSessions = vi.fn();
const completeSession = vi.fn();

vi.mock('@/lib/sessions/api', async (original) => ({
  ...(await original<typeof import('@/lib/sessions/api')>()),
  authenticate: (...a: unknown[]) => authenticate(...a),
}));
vi.mock('@/lib/sessions/wrappers', () => ({ getAcceptedRequest: (...a: unknown[]) => getAcceptedRequest(...a) }));
vi.mock('@/lib/sessions/data', () => ({
  createSession: (...a: unknown[]) => createSession(...a),
  listSessions: (...a: unknown[]) => listSessions(...a),
  completeSession: (...a: unknown[]) => completeSession(...a),
}));

const { GET, PATCH, POST } = await import('@/app/api/sessions/route');

const ME = { id: 'a1b2c3d4-0001-4000-8000-000000000001', name: 'Me', photoUrl: null, isVolunteer: false };
const OTHER = { id: 'a1b2c3d4-0002-4000-8000-000000000002', name: 'Other', photoUrl: null };
const CONTEXT = { requestId: 'b1b2c3d4-0001-4000-8000-000000000001', requestTitle: 'Java help', category: 'Programming', requester: { id: ME.id, name: ME.name, photoUrl: null }, volunteer: OTHER };
const BODY = { requestId: CONTEXT.requestId, scheduledDatetime: '2026-10-19T00:00:00.000Z', supportMode: 'Chat' };

const post = (body: unknown) => POST(new Request('http://x/api/sessions', { method: 'POST', body: JSON.stringify(body) }));
const get = (qs = '') => GET(new Request(`http://x/api/sessions${qs}`));
const patch = (body: unknown) => PATCH(new Request('http://x/api/sessions', { method: 'PATCH', body: JSON.stringify(body) }));

beforeEach(() => {
  vi.resetAllMocks();
  authenticate.mockResolvedValue({ db: {}, me: ME });
});

describe('POST /api/sessions', () => {
  it('401 when not signed in', async () => {
    authenticate.mockResolvedValue(null);
    expect((await post(BODY)).status).toBe(401);
  });

  it('400 with field-level messages for bad input', async () => {
    const res = await post({ requestId: 'x', scheduledDatetime: 'y', supportMode: 'Zoom' });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('validation');
    expect(Object.keys(json.fields).sort()).toEqual(['requestId', 'scheduledDatetime', 'supportMode']);
    expect(getAcceptedRequest).not.toHaveBeenCalled();
  });

  it('400 when the body is not JSON', async () => {
    const res = await POST(new Request('http://x/api/sessions', { method: 'POST', body: 'not json' }));
    expect(res.status).toBe(400);
  });

  it('404 when the request is missing, not accepted, or not theirs', async () => {
    getAcceptedRequest.mockResolvedValue(null);
    expect((await post(BODY)).status).toBe(404);
    expect(createSession).not.toHaveBeenCalled();
  });

  it('403 when the caller is neither requester nor volunteer', async () => {
    getAcceptedRequest.mockResolvedValue({ ...CONTEXT, requester: OTHER, volunteer: { ...OTHER, id: 'a1b2c3d4-0003-4000-8000-000000000003' } });
    expect((await post(BODY)).status).toBe(403);
    expect(createSession).not.toHaveBeenCalled();
  });

  it('409 with the agreed wording when the slot was just taken', async () => {
    getAcceptedRequest.mockResolvedValue(CONTEXT);
    createSession.mockResolvedValue({ ok: false, error: { status: 409, error: 'slot_taken', message: 'That time is no longer available, please pick a different time' } });
    const res = await post(BODY);
    expect(res.status).toBe(409);
    expect((await res.json()).message).toBe('That time is no longer available, please pick a different time');
  });

  it('201 with the new session on success', async () => {
    getAcceptedRequest.mockResolvedValue(CONTEXT);
    createSession.mockResolvedValue({ ok: true, session: { id: 'c1', status: 'Scheduled' } });
    const res = await post(BODY);
    expect(res.status).toBe(201);
    expect((await res.json()).session).toMatchObject({ id: 'c1', status: 'Scheduled' });
  });
});

describe('GET /api/sessions', () => {
  it('401 when not signed in', async () => {
    authenticate.mockResolvedValue(null);
    expect((await get()).status).toBe(401);
  });

  it('400 for an unknown status filter', async () => {
    expect((await get('?status=Nope')).status).toBe(400);
  });

  it('passes the filters through and returns the list', async () => {
    listSessions.mockResolvedValue([{ id: 'c1' }]);
    const res = await get('?status=Scheduled&upcoming=true');
    expect(res.status).toBe(200);
    expect(listSessions).toHaveBeenCalledWith({}, ME.id, { status: 'Scheduled', upcoming: true });
    expect((await res.json()).sessions).toEqual([{ id: 'c1' }]);
  });

  it('500 with a safe message if the query fails', async () => {
    listSessions.mockRejectedValue(new Error('db exploded: secret detail'));
    const res = await get();
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/secret detail/);
  });
});

describe('PATCH /api/sessions', () => {
  it('401 when not signed in', async () => {
    authenticate.mockResolvedValue(null);
    expect((await patch({ sessionId: 'c1b2c3d4-0001-4000-8000-000000000001' })).status).toBe(401);
  });

  it('400 for an invalid session id without calling the database helper', async () => {
    const res = await patch({ sessionId: 'not-a-uuid' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('validation');
    expect(completeSession).not.toHaveBeenCalled();
  });

  it('calls the persistence helper and returns success', async () => {
    const sessionId = 'c1b2c3d4-0001-4000-8000-000000000001';
    completeSession.mockResolvedValue({ ok: true });
    const res = await patch({ sessionId });
    expect(res.status).toBe(200);
    expect(completeSession).toHaveBeenCalledWith({}, sessionId);
    expect(await res.json()).toEqual({ success: true });
  });

  it('preserves authorization and state conflict errors', async () => {
    completeSession.mockResolvedValue({ ok: false, error: { status: 403, error: 'forbidden', message: 'You can only complete your own support sessions' } });
    const res = await patch({ sessionId: 'c1b2c3d4-0001-4000-8000-000000000001' });
    expect(res.status).toBe(403);
    expect((await res.json()).message).toBe('You can only complete your own support sessions');
  });
});
