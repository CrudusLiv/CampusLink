import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fail } from '@/lib/sessions/api';
import { bearerToken } from '@/lib/sessions/server';
import { getAcceptedRequest, getCurrentUser } from '@/lib/sessions/wrappers';

// A tiny stand-in for the Supabase client: from(table).select().eq()/in().maybeSingle() answers from `tables`.
type Rows = Record<string, unknown>;
function fakeDb(tables: Record<string, Rows | Rows[] | null>, user: { id?: string } | null = { id: 'u1' }) {
  const from = vi.fn((table: string) => {
    const builder: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'in']) builder[m] = () => builder;
    builder.maybeSingle = () => Promise.resolve({ data: tables[table] ?? null });
    builder.then = (resolve: (v: unknown) => void) => resolve({ data: tables[table] ?? [] });
    return builder;
  });
  return { from, auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) } };
}

describe('bearerToken (TCUC3_17)', () => {
  const req = (authorization?: string) => new Request('http://x/api/sessions', { headers: authorization ? { authorization } : {} });
  it('returns the token after "Bearer "', () => expect(bearerToken(req('Bearer abc.def.ghi'))).toBe('abc.def.ghi'));
  it('accepts any letter case and extra spaces, and trims the token', () => expect(bearerToken(req('bearer    tok  '))).toBe('tok'));
  it('is null when the header is missing', () => expect(bearerToken(req())).toBeNull());
  it('is null for another scheme', () => expect(bearerToken(req('Basic abc'))).toBeNull());
  it('is null when nothing follows "Bearer"', () => expect(bearerToken(req('Bearer '))).toBeNull());
});

describe('fail (TCUC3_18)', () => {
  it('returns the status and an error body without fields', async () => {
    const res = fail(409, 'slot_taken', 'That time is no longer available');
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'slot_taken', message: 'That time is no longer available' });
  });
  it('adds the field messages only when there are some', async () => {
    const res = fail(400, 'invalid', 'Check the form', { supportMode: 'Choose a support mode' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid', message: 'Check the form', fields: { supportMode: 'Choose a support mode' } });
  });
});

describe('authenticate (TCUC3_19)', () => {
  const dbForToken = vi.fn();
  const currentUser = vi.fn();
  beforeEach(() => {
    vi.resetModules(); vi.resetAllMocks();
    vi.doMock('@/lib/sessions/server', async (original) => ({ ...(await original<typeof import('@/lib/sessions/server')>()), dbForToken: (...a: unknown[]) => dbForToken(...a) }));
    vi.doMock('@/lib/sessions/wrappers', () => ({ getCurrentUser: (...a: unknown[]) => currentUser(...a) }));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  const run = async (headers: Record<string, string>) => (await import('@/lib/sessions/api')).authenticate(new Request('http://x', { headers }));

  it('is null and never opens the database without a token', async () => {
    expect(await run({})).toBeNull();
    expect(dbForToken).not.toHaveBeenCalled();
  });
  it('is null when the token does not belong to a user with a profile', async () => {
    dbForToken.mockReturnValue({}); currentUser.mockResolvedValue(null);
    expect(await run({ authorization: 'Bearer bad' })).toBeNull();
  });
  it('returns the user-scoped client and the profile for a valid token', async () => {
    const db = { tag: 'db' }; const me = { id: 'u1', name: 'Me', photoUrl: null, isVolunteer: true };
    dbForToken.mockReturnValue(db); currentUser.mockResolvedValue(me);
    expect(await run({ authorization: 'Bearer good' })).toEqual({ db, me });
    expect(dbForToken).toHaveBeenCalledWith('good');
  });
});

describe('getCurrentUser (TCUC3_20)', () => {
  it('is null when the token has no user', async () => expect(await getCurrentUser(fakeDb({}, null) as never, 't')).toBeNull());
  it('is null when the user has no profile row', async () => expect(await getCurrentUser(fakeDb({ users: null }) as never, 't')).toBeNull());
  it('returns name, photo and the volunteer flag', async () => {
    const db = fakeDb({ users: { name: 'Aisha', photo_url: 'https://x/a.png' }, volunteer_profile: { is_volunteer: true } });
    expect(await getCurrentUser(db as never, 't')).toEqual({ id: 'u1', name: 'Aisha', photoUrl: 'https://x/a.png', isVolunteer: true });
  });
  it('treats a missing volunteer profile as not a volunteer and a missing photo as null', async () => {
    const db = fakeDb({ users: { name: 'Sara', photo_url: null }, volunteer_profile: null });
    expect(await getCurrentUser(db as never, 't')).toEqual({ id: 'u1', name: 'Sara', photoUrl: null, isVolunteer: false });
  });
});

describe('getAcceptedRequest (TCUC3_21)', () => {
  const ID = 'd3d3d3d3-0004-4000-8000-000000000004';
  const request = (over: Rows = {}) => ({ request_id: ID, title: 'Java help', category: 'Programming', status: 'Accepted', requester_id: 'r1', volunteer_id: 'v1', ...over });
  const people = [{ user_id: 'r1', name: 'Seeker', photo_url: null }, { user_id: 'v1', name: 'Volunteer', photo_url: null }];

  it('is null for an id that is not a UUID, without asking the database', async () => {
    const db = fakeDb({});
    expect(await getAcceptedRequest(db as never, 'not-a-uuid')).toBeNull();
    expect(db.from).not.toHaveBeenCalled();
  });
  it.each([['Pending'], ['Declined'], ['Completed'], ['Cancelled']])('is null while the request is %s', async (status) => {
    expect(await getAcceptedRequest(fakeDb({ support_request: request({ status }), users: people }) as never, ID)).toBeNull();
  });
  it('is null when nobody is assigned or the request is hidden from the caller', async () => {
    expect(await getAcceptedRequest(fakeDb({ support_request: request({ volunteer_id: null }), users: people }) as never, ID)).toBeNull();
    expect(await getAcceptedRequest(fakeDb({ support_request: null, users: people }) as never, ID)).toBeNull();
  });
  it('is null when one of the two people cannot be loaded', async () => {
    expect(await getAcceptedRequest(fakeDb({ support_request: request(), users: [people[0]] }) as never, ID)).toBeNull();
  });
  it('returns the booking context for an accepted request, with names and photos only', async () => {
    const context = await getAcceptedRequest(fakeDb({ support_request: request(), users: people }) as never, ID);
    expect(context).toEqual({
      requestId: ID, requestTitle: 'Java help', category: 'Programming',
      requester: { id: 'r1', name: 'Seeker', photoUrl: null }, volunteer: { id: 'v1', name: 'Volunteer', photoUrl: null },
    });
  });
});
