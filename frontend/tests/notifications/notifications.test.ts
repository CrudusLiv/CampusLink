import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

describe('unified notification migration', () => {
  it('notifies only the assigned volunteer for a new pending request', async () => {
    const sql = await readMigration();
    expect(sql).toMatch(/tg_op = 'INSERT'[\s\S]*new\.status::text <> 'Pending'[\s\S]*v_recipient := new\.volunteer_id/i);
    expect(sql).toMatch(/'request_pending'/i);
  });

  it('notifies the requester on acceptance and decline, and the assigned volunteer on pending cancellation', async () => {
    const sql = await readMigration();
    expect(sql).toMatch(/old\.status::text = 'Pending' and new\.status::text in \('Accepted', 'Declined', 'Cancelled'\)/i);
    expect(sql).toMatch(/v_recipient := new\.requester_id/i);
    expect(sql).toMatch(/when 'Accepted' then 'request_accepted'[\s\S]*when 'Declined' then 'request_declined'[\s\S]*else 'request_cancelled'/i);
    expect(sql).toMatch(/if new\.status::text = 'Cancelled' then\s+v_recipient := new\.volunteer_id/i);
  });

  it('does not notify on request edits, completed states, or accepted-session request cancellation', async () => {
    const sql = await readMigration();
    expect(sql).toMatch(/elsif old\.status::text = 'Pending'/i);
    expect(sql).not.toMatch(/new\.status::text in \([^)]*Completed/i);
  });

  it('deduplicates each request event and keeps notification access account-scoped', async () => {
    const sql = await readMigration();
    expect(sql).toMatch(/unique index if not exists notification_event_key_uidx/i);
    expect(sql).toMatch(/on conflict \(event_key\) where event_key is not null do nothing/i);
    expect(sql).toMatch(/using \(\(select auth\.uid\(\)\) = user_id\)/i);
    expect(sql).toMatch(/with check \(\(select auth\.uid\(\)\) = user_id\)/i);
    expect(sql).toMatch(/grant update \(read_status\) on public\.notification to authenticated/i);
    expect(sql).not.toMatch(/grant (insert|delete)[^;]*notification/i);
  });

  it('publishes notification inserts for Supabase Realtime', async () => {
    const sql = await readMigration();
    expect(sql).toMatch(/alter publication supabase_realtime add table public\.notification/i);
    const component = await readFile(resolve(root, 'frontend/components/layout/NotificationBell.tsx'), 'utf8');
    expect(component).toMatch(/postgres_changes/);
    expect(component).toMatch(/read_status: true/);
    expect(component).toMatch(/aria-expanded=\{open\}/);
    expect(component).toMatch(/setToasts\(\(current\) => current\.filter/);
    expect(component).toMatch(/setTimeout\(\(\) => onDismiss\(notice\.notification_id\), 2000\)/);
    expect(component).toMatch(/setPanelNotices\(notices\)/);
    expect(component).toMatch(/setPanelNotices\(\[\]\)/);
    expect(component).not.toMatch(/aria-hidden="true">✓/);
    const toast = component.slice(component.indexOf('function ToastMessage'));
    expect(toast).not.toMatch(/>Close</);
  });
});

async function readMigration() {
  return readFile(resolve(root, 'backend/supabase/migrations/20261029000300_realtime_notifications.sql'), 'utf8');
}
