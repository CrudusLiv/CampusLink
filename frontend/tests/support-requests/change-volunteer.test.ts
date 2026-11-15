import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const reassignRouteSource = await readFile(
  new URL('../../app/api/support-requests/[id]/reassign/route.ts', import.meta.url),
  'utf8',
);
const requestDetailSource = await readFile(
  new URL('../../app/support-requests/[id]/SupportRequestDetail.tsx', import.meta.url),
  'utf8',
);
const submitRequestFormSource = await readFile(
  new URL('../../app/sessions/SubmitRequestForm.tsx', import.meta.url),
  'utf8',
);

describe('TCUC2_38 allows reassignment of a pending request', () => {
  it('checks that the owned request and its volunteer assignment are still Pending', () => {
    expect(reassignRouteSource).toMatch(/\.eq\("status", "Pending"\)/);
    expect(reassignRouteSource).toMatch(/\.eq\("requester_id", auth\.me\.id\)/);
    expect(reassignRouteSource).toMatch(/if \(!request\) return fail\(409, "conflict"/);
    expect(reassignRouteSource).toMatch(/rpc\("reassign_pending_support_request"/);
  });
});

describe('TCUC2_39 prevents reassignment when a request is no longer pending', () => {
  it.each(['Accepted', 'Declined', 'Completed', 'Cancelled'])(
    'rejects %s requests in change-volunteer mode',
    (status) => {
      expect(requestDetailSource).toMatch(/data\.status !== "Pending"/);
      expect(requestDetailSource).toMatch(/\(mode === "edit" \|\| mode === "change-volunteer"\) && data\.status !== "Pending"/);
      expect(requestDetailSource).toMatch(/setError\(mode === "edit" \? "Only pending requests can be edited\." : "Only pending requests can change volunteers\."\)/);
      expect(reassignRouteSource).toMatch(/\.eq\("status", "Pending"\)/);
      expect(status).not.toBe('Pending');
    },
  );
});

describe('TCUC2_40 returns reassignment errors to the user', () => {
  it('maps supported reassignment API errors to their route messages', () => {
    expect(reassignRouteSource).toMatch(/message\.includes\("REQUEST_NOT_PENDING"\)\) return fail\(409, "conflict", "This request is no longer pending\."\)/);
    expect(reassignRouteSource).toMatch(/message\.includes\("VOLUNTEER_TIME_CONFLICT"\)\) return fail\(409, "conflict", "The selected volunteer has a conflicting commitment\. Choose another available volunteer\."\)/);
    expect(reassignRouteSource).toMatch(/message\.includes\("PREFERRED_TIME_REQUIRED"\)\) return fail\(400, "validation", "This support request does not have a valid preferred time\./);
    expect(reassignRouteSource).toMatch(/message\.includes\("REQUEST_NOT_OWNED"\)\) return fail\(404, "not_found", "We couldn't find this support request\."\)/);
    expect(reassignRouteSource).toMatch(/message\.includes\("ASSIGNMENT_CHANGED"\)\) return fail\(409, "conflict", "The assigned volunteer changed\./);
    expect(reassignRouteSource).toMatch(/message\.includes\("VOLUNTEER_INELIGIBLE"\)\) return fail\(400, "validation", "Choose an eligible volunteer for this request category\."\)/);
    expect(reassignRouteSource).toMatch(/message\.includes\("VOLUNTEER_UNAVAILABLE"\)\) return fail\(400, "validation", "The selected volunteer is not available at the request's date and time\."\)/);
    expect(reassignRouteSource).toMatch(/message\.includes\("INVALID_VOLUNTEER"\)\) return fail\(400, "validation", "Choose a different volunteer\."\)/);
    expect(reassignRouteSource).toMatch(/return fail\(500, "unknown", "We couldn't change the volunteer\. Please try again\."\)/);
  });

  it('shows the API error message in the change-volunteer form error', () => {
    expect(submitRequestFormSource).toMatch(/payload\.message \?\? "Volunteer replacement failed\."/);
    expect(submitRequestFormSource).toMatch(/setSubmitError\(`We couldn't \$\{mode === "edit" \? "save your changes" : mode === "change-volunteer" \? "change the volunteer" : "submit your request"\}: \$\{error\.message\}`\)/);
  });
});
