// Turns the database's error names (raised by session_guard + constraints) into HTTP answers.
export type ApiError = { status: number; error: string; message: string };

export const SLOT_TAKEN_MESSAGE = 'That time is no longer available, please pick a different time';

export function mapDbError(e: { message?: string; code?: string }): ApiError {
  const m = e.message ?? '';
  if (/SLOT_TAKEN/.test(m)) return { status: 409, error: 'slot_taken', message: SLOT_TAKEN_MESSAGE };
  if (/session_one_active_per_request/.test(m)) {
    return { status: 409, error: 'already_scheduled', message: 'This support request already has a scheduled session' };
  }
  if (/OUTSIDE_AVAILABILITY/.test(m)) {
    return { status: 409, error: 'outside_availability', message: "That time is outside the volunteer's availability, please pick a different time" };
  }
  if (/PAST_SLOT/.test(m)) return { status: 400, error: 'past_slot', message: 'Pick a time in the future' };
  if (/NOT_PARTICIPANT/.test(m)) return { status: 403, error: 'forbidden', message: 'You can only schedule your own support requests' };
  if (/REQUEST_NOT_FOUND/.test(m)) return { status: 404, error: 'not_found', message: 'Support request not found' };
  if (/NO_VOLUNTEER/.test(m)) return { status: 409, error: 'request_not_accepted', message: 'This support request has no volunteer yet' };
  if (e.code === '42501') return { status: 403, error: 'forbidden', message: 'You can only schedule an accepted support request you belong to' };
  if (e.code === '23514') return { status: 400, error: 'validation', message: 'Meeting link must be a valid https:// link' };
  return { status: 500, error: 'unknown', message: 'Something went wrong. Please try again.' };
}
