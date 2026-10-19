import { z } from "zod";

/** Fields accepted from the request form; requester_id and status are server controlled. */
export const supportRequestCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(5000),
  category: z.string().trim().min(1).max(100),
  requested_date: z.iso.date(),
  requested_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/, "Choose a valid time"),
  support_mode: z.string().trim().min(1).max(40),
  volunteer_id: z.uuid("Choose a volunteer"),
  preferred_time: z.iso.datetime({ offset: true }),
});
