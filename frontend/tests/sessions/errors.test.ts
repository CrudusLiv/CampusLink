import { describe, expect, it } from 'vitest';
import { mapDbError, SLOT_TAKEN_MESSAGE } from '@/lib/sessions/errors';

describe('mapDbError', () => {
  it.each([
    ['SLOT_TAKEN', undefined, 409, 'slot_taken'],
    ['duplicate key value violates unique constraint "session_one_active_per_request"', '23505', 409, 'already_scheduled'],
    ['OUTSIDE_AVAILABILITY', undefined, 409, 'outside_availability'],
    ['PAST_SLOT', undefined, 400, 'past_slot'],
    ['NOT_PARTICIPANT', undefined, 403, 'forbidden'],
    ['REQUEST_NOT_FOUND', undefined, 404, 'not_found'],
    ['NO_VOLUNTEER', undefined, 409, 'request_not_accepted'],
    ['new row violates row-level security policy for table "session"', '42501', 403, 'forbidden'],
    ['violates check constraint "session_meeting_link_https"', '23514', 400, 'validation'],
    ['something unexpected', 'XX000', 500, 'unknown'],
  ])('maps %s (db code %s) to HTTP %i "%s"', (message, code, status, error) => {
    expect(mapDbError({ message, code })).toMatchObject({ status, error });
  });

  it('uses the exact wording the brief asks for on a lost race', () => {
    expect(mapDbError({ message: 'SLOT_TAKEN' }).message).toBe(SLOT_TAKEN_MESSAGE);
    expect(SLOT_TAKEN_MESSAGE).toBe('That time is no longer available, please pick a different time');
  });

  it('copes with a missing message', () => {
    expect(mapDbError({})).toMatchObject({ status: 500, error: 'unknown' });
  });
});
