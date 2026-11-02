import { describe, expect, it } from 'vitest';
import { notificationTone } from '@/lib/notifications/display';

describe('notification display tone', () => {
  it('uses green for newly assigned requests and accepted requests', () => {
    expect(notificationTone('request_pending')).toBe('success');
    expect(notificationTone('request_accepted')).toBe('success');
  });

  it('uses red for other notification types', () => {
    expect(notificationTone('request_declined')).toBe('error');
    expect(notificationTone('request_cancelled')).toBe('error');
    expect(notificationTone('session_cancelled')).toBe('error');
  });
});
