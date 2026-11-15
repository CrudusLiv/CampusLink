import { afterEach, describe, expect, it, vi } from 'vitest';
import { listSessions } from '@/lib/sessions/data';
import { feedbackSchema } from '@/lib/sessions/schemas';
import { formatRange, hasEnded } from '@/lib/sessions/time';
import { bookableMode } from '@/lib/sessions/types';

describe('session end and display edges (TCUC3_22)', () => {
  const start = '2026-11-16T03:00:00.000Z'; // 11:00 in Kuala Lumpur
  const startMs = new Date(start).getTime();
  it('has not ended 1 ms before the hour is over', () => expect(hasEnded(start, startMs + 3_600_000 - 1)).toBe(false));
  it('has ended exactly when the hour is over', () => expect(hasEnded(start, startMs + 3_600_000)).toBe(true));
  it('has not ended while it is still to come', () => expect(hasEnded(start, startMs - 1)).toBe(false));
  it('shows a session that runs past midnight in Kuala Lumpur time', () => expect(formatRange('2026-11-16T15:30:00.000Z')).toBe('11:30 PM – 12:30 AM'));
});

describe('feedback limits (TCUC3_23)', () => {
  const id = 'd3d3d3d3-0012-4000-8000-000000000012';
  it.each([[1], [5]])('accepts %s stars, the lowest and highest rating', (rating) => expect(feedbackSchema.safeParse({ sessionId: id, rating }).success).toBe(true));
  it.each([[0], [6], [3.5], ['4'], [null]])('rejects the rating %s', (rating) => {
    const result = feedbackSchema.safeParse({ sessionId: id, rating });
    expect(result.success).toBe(false);
  });
  it('accepts a comment of exactly 1000 characters and rejects 1001', () => {
    expect(feedbackSchema.safeParse({ sessionId: id, rating: 4, comment: 'a'.repeat(1000) }).success).toBe(true);
    const tooLong = feedbackSchema.safeParse({ sessionId: id, rating: 4, comment: 'a'.repeat(1001) });
    expect(tooLong.success).toBe(false);
    expect(JSON.stringify(tooLong.error?.issues)).toContain('Keep the comment under 1000 characters');
  });
  it('trims the comment and allows it to be left out', () => {
    expect(feedbackSchema.parse({ sessionId: id, rating: 5, comment: '  Very clear.  ' }).comment).toBe('Very clear.');
    expect(feedbackSchema.parse({ sessionId: id, rating: 5 }).comment).toBeUndefined();
  });
});

describe('bookableMode: which saved modes Accept can book (TCUC3_24)', () => {
  it.each([['Online', 'Online'], ['online', 'Online'], ['In-Person', 'In-Person'], ['In-person', 'In-Person'], ['  in-person ', 'In-Person']])('%s can be booked as %s', (saved, booked) => {
    expect(bookableMode(saved)).toBe(booked);
  });
  it.each([['Chat'], ['Both'], ['Zoom'], [''], [null], [undefined]])('%s cannot be booked, so Accept leaves the request Pending', (saved) => {
    expect(bookableMode(saved as string | null | undefined)).toBeNull();
  });
});

describe('listSessions filters (TCUC3_25)', () => {
  afterEach(() => vi.useRealTimers());
  const NOW = new Date('2026-11-16T04:00:00.000Z');
  const row = (over: Record<string, unknown> = {}) => ({
    session_id: 's1', request_id: 'q1', scheduled_datetime: '2026-11-18T07:00:00.000Z', support_mode: 'Online', status: 'Scheduled', meeting_link: null, join_details: null,
    support_request: { title: 'Java help', description: null, requester_id: 'r1', volunteer_id: 'v1' }, ...over,
  });
  /** A stand-in for the query builder: it records each filter call and answers with `data`. */
  function fakeDb(sessions: unknown[], people: unknown[] = [{ user_id: 'r1', name: 'Seeker', photo_url: null }, { user_id: 'v1', name: 'Volunteer', photo_url: null }], feedback: unknown[] = []) {
    const calls: [string, ...unknown[]][] = [];
    const builder = (table: string) => {
      const b: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'order', 'or', 'gte', 'in']) b[m] = (...a: unknown[]) => { if (table === 'session') calls.push([m, ...a]); return b; };
      b.then = (resolve: (v: unknown) => void) => resolve({ data: table === 'session' ? sessions : table === 'users' ? people : feedback, error: null });
      return b;
    };
    return { db: { from: (t: string) => builder(t) } as never, calls };
  }
  const has = (calls: [string, ...unknown[]][], name: string, ...args: unknown[]) => calls.some(([n, ...a]) => n === name && args.every((x, i) => a[i] === x));

  it('student role keeps only sessions of requests the viewer asked for', async () => {
    const { db, calls } = fakeDb([row()]);
    await listSessions(db, 'r1', { role: 'student' });
    expect(has(calls, 'eq', 'support_request.requester_id', 'r1')).toBe(true);
    expect(has(calls, 'eq', 'support_request.volunteer_id')).toBe(false);
  });
  it('volunteer role keeps only sessions the viewer is the volunteer of', async () => {
    const { db, calls } = fakeDb([row()]);
    await listSessions(db, 'v1', { role: 'volunteer' });
    expect(has(calls, 'eq', 'support_request.volunteer_id', 'v1')).toBe(true);
  });
  it('upcoming keeps a session until its hour is over and lists soonest first', async () => {
    vi.useFakeTimers(); vi.setSystemTime(NOW);
    const { db, calls } = fakeDb([row()]);
    await listSessions(db, 'r1', { status: 'Scheduled', upcoming: true });
    expect(has(calls, 'gte', 'scheduled_datetime', '2026-11-16T03:00:00.000Z')).toBe(true); // now minus one hour
    expect(has(calls, 'order', 'scheduled_datetime')).toBe(true);
    expect(calls.find(([n]) => n === 'order')?.[2]).toEqual({ ascending: true });
    expect(has(calls, 'eq', 'status', 'Scheduled')).toBe(true);
  });
  it('history lists cancelled and elapsed sessions, newest first', async () => {
    vi.useFakeTimers(); vi.setSystemTime(NOW);
    const { db, calls } = fakeDb([row({ status: 'Cancelled' })]);
    await listSessions(db, 'r1', { history: true });
    expect(calls.find(([n]) => n === 'order')?.[2]).toEqual({ ascending: false });
    expect(String(calls.find(([n]) => n === 'or')?.[1])).toContain('status.eq.Cancelled');
    expect(String(calls.find(([n]) => n === 'or')?.[1])).toContain('scheduled_datetime.lt.2026-11-16T03:00:00.000Z');
  });
  it('one session by id adds only the id filter', async () => {
    const { db, calls } = fakeDb([row()]);
    await listSessions(db, 'r1', { id: 's1' });
    expect(has(calls, 'eq', 'session_id', 's1')).toBe(true);
  });
  it('drops a session when either person cannot be loaded, and returns names only', async () => {
    const { db } = fakeDb([row(), row({ session_id: 's2', support_request: { title: 'X', description: null, requester_id: 'r1', volunteer_id: 'gone' } })]);
    const list = await listSessions(db, 'r1');
    expect(list).toHaveLength(1);
    expect(JSON.stringify(list)).not.toMatch(/email|student_id|contact/i);
  });
  it('attaches the rating and comment to a completed session', async () => {
    const { db } = fakeDb([row({ status: 'Completed' })], undefined, [{ session_id: 's1', rating: 4, comment: 'Clear.' }]);
    const [s] = await listSessions(db, 'r1');
    expect(s).toMatchObject({ rating: 4, feedback: 'Clear.' });
  });
});
