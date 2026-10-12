import { z } from 'zod';
import { SUPPORT_MODES } from './types';

/** Shared by the schedule form (client) and POST /api/sessions (server). */
export const scheduleSchema = z.object({
  requestId: z.uuid('Missing or invalid support request'),
  scheduledDatetime: z.iso.datetime({ offset: true, error: 'Pick a date and time' }),
  supportMode: z.enum(SUPPORT_MODES, { error: 'Choose a support mode' }),
  meetingLink: z
    .string()
    .trim()
    .max(2048)
    .regex(/^https:\/\/[^\s]+$/i, 'Meeting link must be a valid https:// link')
    .optional(),
});

export type ScheduleInput = z.infer<typeof scheduleSchema>;

/** First message per field, ready to show next to the inputs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const flat = z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
  return Object.fromEntries(Object.entries(flat).map(([k, v]) => [k, v?.[0] ?? 'Invalid value']));
}
