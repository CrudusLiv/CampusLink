import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { setJoinDetails } from '@/lib/sessions/data';
import { joinText, joinUrl } from '@/lib/sessions/join';
import { joinDetailsSchema } from '@/lib/sessions/schemas';

const SESSION_ID = '5f3c2a9e-0b1d-4c8e-9a47-1d2e3f4a5b6c';

describe('joinUrl and joinText (FR16)', () => {
  it('opens only https links and shows anything else as text', () => {
    expect(joinUrl({ joinDetails: 'https://meet.google.com/abc-defg-hij', meetingLink: null })).toBe('https://meet.google.com/abc-defg-hij');
    expect(joinText({ joinDetails: 'https://meet.google.com/abc-defg-hij', meetingLink: null })).toBeNull();
    expect(joinUrl({ joinDetails: 'Library, level 2', meetingLink: null })).toBeNull();
    expect(joinText({ joinDetails: 'Library, level 2', meetingLink: null })).toBe('Library, level 2');
  });

  it('never opens javascript: or http: links, and falls back to the older meeting link', () => {
    expect(joinUrl({ joinDetails: 'javascript:alert(1)', meetingLink: null })).toBeNull();
    expect(joinUrl({ joinDetails: 'http://insecure.example', meetingLink: null })).toBeNull();
    expect(joinUrl({ joinDetails: null, meetingLink: 'https://zoom.us/j/123' })).toBe('https://zoom.us/j/123');
    expect(joinUrl({ joinDetails: null, meetingLink: null })).toBeNull();
  });
});

describe('joinDetailsSchema', () => {
  it('accepts a link or a place, trims it, and allows an empty value to clear it', () => {
    expect(joinDetailsSchema.parse({ sessionId: SESSION_ID, details: '  Room 3.12  ' })).toEqual({ sessionId: SESSION_ID, details: 'Room 3.12', saveAsDefault: false });
    expect(joinDetailsSchema.parse({ sessionId: SESSION_ID, details: '', saveAsDefault: true }).saveAsDefault).toBe(true);
  });

  it('rejects a bad session id and more than 300 characters', () => {
    expect(joinDetailsSchema.safeParse({ sessionId: 'x', details: 'a' }).success).toBe(false);
    expect(joinDetailsSchema.safeParse({ sessionId: SESSION_ID, details: 'a'.repeat(301) }).success).toBe(false);
  });
});

describe('setJoinDetails persistence helper', () => {
  it('calls the database function with the details and the save-as-default choice', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    expect(await setJoinDetails({ rpc } as never, SESSION_ID, 'Room 3.12', true)).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith('set_session_join_details', { p_session_id: SESSION_ID, p_details: 'Room 3.12', p_save_default: true });
  });

  it.each([
    [{ message: 'SESSION_NOT_FOUND', code: 'P0002' }, 404, 'not_found'],
    [{ message: 'NOT_VOLUNTEER', code: '42501' }, 403, 'forbidden'],
    [{ message: 'SESSION_NOT_SCHEDULED', code: 'P0001' }, 409, 'invalid_status'],
    [{ message: 'DETAILS_TOO_LONG', code: 'P0001' }, 400, 'validation'],
    [{ message: 'internal detail', code: 'XX000' }, 500, 'unknown'],
  ])('maps database error %s to an API error', async (error, status, code) => {
    const rpc = vi.fn().mockResolvedValue({ error });
    expect(await setJoinDetails({ rpc } as never, SESSION_ID, 'x', false)).toMatchObject({ ok: false, error: { status, error: code } });
  });
});

describe('join details database migration', () => {
  it('lets only the volunteer of a scheduled session set it, and copies the saved default on booking', async () => {
    const path = resolve(dirname(fileURLToPath(import.meta.url)), '../../../backend/supabase/migrations/20261029000200_session_join_details.sql');
    const sql = await readFile(path, 'utf8');
    expect(sql).toMatch(/security\s+definer/i);
    expect(sql).toMatch(/\(select auth\.uid\(\)\) <> v_volunteer[\s\S]*?NOT_VOLUNTEER/i);
    expect(sql).toMatch(/v_status <> 'Scheduled'[\s\S]*?SESSION_NOT_SCHEDULED/i);
    expect(sql).toMatch(/char_length\(v_details\) > 300[\s\S]*?DETAILS_TOO_LONG/i);
    expect(sql).toMatch(/before insert on public\.session/i);
    expect(sql).toMatch(/revoke all on function public\.set_session_join_details\(uuid, text, boolean\) from public, anon/i);
    expect(sql).toMatch(/grant execute on function public\.set_session_join_details\(uuid, text, boolean\) to authenticated/i);
  });
});
