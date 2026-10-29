import type { SessionView } from './types';

const HTTPS_LINK = /^https:\/\/\S+$/i;

type JoinInfo = Pick<SessionView, 'joinDetails' | 'meetingLink'>;

/** The https link to open for a session: the volunteer's details if they are a link, else the older meeting link. */
export function joinUrl(session: JoinInfo): string | null {
  const details = session.joinDetails?.trim();
  if (details && HTTPS_LINK.test(details)) return details;
  return session.meetingLink && HTTPS_LINK.test(session.meetingLink) ? session.meetingLink : null;
}

/** The place or instructions to show as text (anything that is not a bare https link). */
export function joinText(session: JoinInfo): string | null {
  const details = session.joinDetails?.trim();
  return details && !HTTPS_LINK.test(details) ? details : null;
}
