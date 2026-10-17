import { describe, expect, it } from 'vitest';
import { fieldErrors, listQuerySchema, scheduleSchema } from '@/lib/sessions/schemas';

const valid = {
  requestId: 'b1b2c3d4-0001-4000-8000-000000000001',
  scheduledDatetime: '2026-10-19T00:00:00.000Z',
  supportMode: 'Online',
  meetingLink: 'https://meet.google.com/abc-defg-hij',
};

describe('scheduleSchema', () => {
  it('accepts a complete request', () => {
    expect(scheduleSchema.safeParse(valid).success).toBe(true);
  });

  it('does not require a meeting link', () => {
    const { meetingLink: _omit, ...rest } = valid;
    void _omit;
    expect(scheduleSchema.safeParse({ ...rest, supportMode: 'Chat' }).success).toBe(true);
  });

  it('accepts an offset timestamp as well as Z', () => {
    expect(scheduleSchema.safeParse({ ...valid, scheduledDatetime: '2026-10-19T08:00:00+08:00' }).success).toBe(true);
  });

  it.each([
    ['requestId', { requestId: 'not-a-uuid' }],
    ['scheduledDatetime', { scheduledDatetime: 'tomorrow' }],
    ['supportMode', { supportMode: 'Zoom' }],
    ['meetingLink', { meetingLink: 'http://insecure.example' }],
    ['meetingLink', { meetingLink: 'meet.google.com/abc' }],
    ['meetingLink', { meetingLink: 'https://has space.example' }],
  ])('rejects a bad %s with a field-level message', (field, patch) => {
    const result = scheduleSchema.safeParse({ ...valid, ...patch });
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrors(result.error)[field]).toBeTruthy();
  });

  it('reports every bad field at once', () => {
    const result = scheduleSchema.safeParse({ requestId: 'x', scheduledDatetime: 'y', supportMode: 'Zoom' });
    expect(result.success).toBe(false);
    if (!result.success) expect(Object.keys(fieldErrors(result.error)).sort()).toEqual(['requestId', 'scheduledDatetime', 'supportMode']);
  });
});

describe('listQuerySchema', () => {
  it('parses the upcoming flag into a boolean', () => {
    expect(listQuerySchema.parse({ status: 'Scheduled', upcoming: 'true' })).toEqual({ status: 'Scheduled', upcoming: true });
    expect(listQuerySchema.parse({}).upcoming).toBe(false);
  });
  it('rejects unknown statuses', () => {
    expect(listQuerySchema.safeParse({ status: 'Nope' }).success).toBe(false);
  });
});
