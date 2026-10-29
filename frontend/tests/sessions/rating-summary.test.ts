import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('volunteer rating summary database migration (FR18)', () => {
  it('returns only the average, the count and anonymous comments, to signed-in users only', async () => {
    const path = resolve(dirname(fileURLToPath(import.meta.url)), '../../../backend/supabase/migrations/20261029000100_volunteer_rating_summary.sql');
    const sql = await readFile(path, 'utf8');
    expect(sql).toMatch(/security\s+definer/i);
    expect(sql).toMatch(/set\s+search_path\s*=\s*''/i);
    expect(sql).toMatch(/'average'[\s\S]*'count'[\s\S]*'recent'/i);
    expect(sql).toMatch(/limit 5/i);
    expect(sql).toMatch(/revoke all on function public\.volunteer_rating_summary\(uuid\) from public, anon/i);
    expect(sql).toMatch(/grant execute on function public\.volunteer_rating_summary\(uuid\) to authenticated/i);
    // no names, ids of the people who rated, or contact details leave the function
    expect(sql).not.toMatch(/requester_id|\bname\b|email|phone|student_id/i);
  });
});
