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

/** PATCH /api/sessions: complete (default) or cancel an existing session. */
export const completeSessionSchema = z.object({
  sessionId: z.uuid('Missing or invalid session'),
  action: z.enum(['complete', 'cancel']).default('complete'),
});

/** POST /api/sessions/feedback: stars are mandatory, the comment is optional. */
export const feedbackSchema = z.object({
  sessionId: z.uuid('Missing or invalid session'),
  rating: z.number().int('Choose a star rating').min(1, 'Choose a star rating').max(5, 'Choose a star rating'),
  comment: z.string().trim().max(1000, 'Keep the comment under 1000 characters').optional(),
});

export type FeedbackInput = z.infer<typeof feedbackSchema>;

/** PATCH /api/sessions/join-details: the volunteer's meeting link or place; empty clears it. */
export const joinDetailsSchema = z.object({
  sessionId: z.uuid('Missing or invalid session'),
  details: z.string().trim().max(300, 'Keep it under 300 characters'),
  saveAsDefault: z.boolean().optional().default(false),
});

/** GET /api/sessions?status=Scheduled&upcoming=true, ?history=true (Completed + Cancelled, newest first) or ?id= */
export const listQuerySchema = z.object({
  role: z.enum(['student', 'volunteer']).optional(),
  status: z.enum(['Scheduled', 'Completed', 'Cancelled']).optional(),
  upcoming: z.enum(['true', 'false']).optional().transform((v) => v === 'true'),
  history: z.enum(['true', 'false']).optional().transform((v) => v === 'true'),
  id: z.uuid().optional(),
});

/** First message per field, ready to show next to the inputs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const flat = z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
  return Object.fromEntries(Object.entries(flat).map(([k, v]) => [k, v?.[0] ?? 'Invalid value']));
}
