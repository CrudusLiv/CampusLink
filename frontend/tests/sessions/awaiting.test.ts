import { describe, expect, it } from 'vitest';
import { withoutScheduled } from '@/lib/sessions/data';

const reqs = [{ request_id: 'a' }, { request_id: 'b' }, { request_id: 'c' }];

describe('withoutScheduled', () => {
  it('drops requests that already have a scheduled session', () => {
    expect(withoutScheduled(reqs, ['b'])).toEqual([{ request_id: 'a' }, { request_id: 'c' }]);
  });
  it('keeps everything when nothing is scheduled', () => {
    expect(withoutScheduled(reqs, [])).toEqual(reqs);
  });
  it('returns nothing when everything is scheduled, and ignores unknown ids', () => {
    expect(withoutScheduled(reqs, ['a', 'b', 'c', 'zzz'])).toEqual([]);
  });
  it('keeps the original order', () => {
    expect(withoutScheduled(reqs, ['a']).map((r) => r.request_id)).toEqual(['b', 'c']);
  });
});
