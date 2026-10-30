import { describe, expect, it } from 'vitest';
import { isDashboardViewReady, readDashboardView, saveDashboardView } from '@/lib/dashboard-view-storage';

function memoryStore() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

describe('dashboard view preference', () => {
  it('restores Volunteer view after a reload for the same account', () => {
    const store = memoryStore();
    saveDashboardView('user-1', 'volunteer', store);
    expect(readDashboardView('user-1', store)).toBe('volunteer');
  });

  it('keeps preferences separate per account and defaults to Student', () => {
    const store = memoryStore();
    saveDashboardView('user-1', 'volunteer', store);
    expect(readDashboardView('user-2', store)).toBe('student');
    expect(readDashboardView('user-1', store)).toBe('volunteer');
  });

  it('falls back to Student for invalid stored values', () => {
    const store = memoryStore();
    store.setItem('campuslink:dashboard-view:user-1', 'unexpected');
    expect(readDashboardView('user-1', store)).toBe('student');
  });

  it('keeps mode-specific UI unready until the current account preference is restored', () => {
    expect(isDashboardViewReady(true, 'user-1', undefined)).toBe(false);
    expect(isDashboardViewReady(false, 'user-1', undefined)).toBe(false);
    expect(isDashboardViewReady(false, 'user-1', 'user-2')).toBe(false);
    expect(isDashboardViewReady(false, 'user-1', 'user-1')).toBe(true);
    expect(isDashboardViewReady(false, null, null)).toBe(true);
  });
});
