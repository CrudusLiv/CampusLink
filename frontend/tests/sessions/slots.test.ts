import { describe, expect, it } from 'vitest';
import { overlaps } from '@/lib/sessions/slots';

describe('overlaps', () => {
  const t = Date.parse('2026-10-12T02:00:00Z');
  it('treats starts less than an hour apart as a clash', () => {
    expect(overlaps(t, t)).toBe(true);
    expect(overlaps(t, t + 59 * 60_000)).toBe(true);
    expect(overlaps(t, t - 59 * 60_000)).toBe(true);
  });
  it('allows back-to-back sessions', () => {
    expect(overlaps(t, t + 60 * 60_000)).toBe(false);
    expect(overlaps(t, t - 60 * 60_000)).toBe(false);
  });
});
