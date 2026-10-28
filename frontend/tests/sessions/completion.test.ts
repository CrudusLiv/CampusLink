import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { completeSession } from '@/lib/sessions/data';

describe('completeSession persistence helper', () => {
  it('calls the database RPC with the session id', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const result = await completeSession({ rpc } as never, 'session-1');
    expect(rpc).toHaveBeenCalledWith('complete_session', { p_session_id: 'session-1' });
    expect(result).toEqual({ ok: true });
  });

  it.each([
    [{ message: 'SESSION_NOT_FOUND', code: 'P0002' }, 404, 'not_found'],
    [{ message: 'NOT_PARTICIPANT', code: '42501' }, 403, 'forbidden'],
    [{ message: 'SESSION_NOT_SCHEDULED', code: 'P0001' }, 409, 'invalid_status'],
    [{ message: 'SESSION_NOT_STARTED', code: 'P0001' }, 409, 'not_started'],
    [{ message: 'NOT_VOLUNTEER', code: '42501' }, 403, 'forbidden'],
    [{ message: 'CANCEL_TOO_LATE', code: 'P0001' }, 409, 'too_late'],
    [{ message: 'REQUEST_NOT_ACCEPTED', code: 'P0001' }, 409, 'invalid_status'],
    [{ message: 'internal detail', code: 'XX000' }, 500, 'unknown'],
  ])('maps database error %s to an API error', async (error, status, code) => {
    const rpc = vi.fn().mockResolvedValue({ error });
    const result = await completeSession({ rpc } as never, 'session-1');
    expect(result).toMatchObject({ ok: false, error: { status, error: code } });
  });
});

describe('complete session database migration', () => {
  it('enforces participant and state checks before updating both rows', async () => {
    const migrationPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../../backend/supabase/migrations/20261019000100_complete_session_request.sql');
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toMatch(/security\s+definer/i);
    expect(sql).toMatch(/set\s+search_path\s*=\s*''/i);
    expect(sql).toMatch(/auth\.uid\(\)[\s\S]*?not in\s*\(v_requester_id,\s*v_volunteer_id\)/i);
    expect(sql).toMatch(/v_session_status not in \('Scheduled', 'Completed'\)/i);
    expect(sql).toMatch(/v_request_status not in \('Accepted', 'Completed'\)/i);
    expect(sql).toMatch(/update public\.session[\s\S]*status = 'Completed'[\s\S]*completed_at = coalesce\(completed_at, now\(\)\)/i);
    expect(sql).toMatch(/update public\.support_request[\s\S]*set status = 'Completed'/i);
    expect(sql).toMatch(/grant execute on function public\.complete_session\(uuid\) to authenticated/i);
  });
});

describe('cancel session database migration', () => {
  it('needs 24 hours of notice, cancels the request and notifies only the other person', async () => {
    const migrationPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../../backend/supabase/migrations/20261028000100_cancel_notification.sql');
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toMatch(/security\s+definer/i);
    expect(sql).toMatch(/v_caller not in \(v_requester_id, v_volunteer_id\)/i);
    expect(sql).toMatch(/v_starts_at - now\(\) < interval '24 hours'[\s\S]*?CANCEL_TOO_LATE/i);
    expect(sql).toMatch(/update public\.support_request\s+set status = 'Cancelled'/i);
    expect(sql).toMatch(/insert into public\.notification[\s\S]*?case when v_caller = v_requester_id then v_volunteer_id else v_requester_id end/i);
    expect(sql).toMatch(/revoke all on public\.notification from anon, authenticated/i);
    expect(sql).not.toMatch(/grant (insert|delete)[^;]*notification/i);
  });
});
