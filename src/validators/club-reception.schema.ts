import { z } from "zod";

export const clubReceptionSchema = z.object({
  guestName: z.string().trim().min(1, "Name is required.").max(200),
  memberNumber: z.string().trim().max(50).optional().or(z.literal("")),
  isVisitor: z.boolean().default(false),
  purpose: z.string().trim().max(300).optional().or(z.literal("")),
});
export type ClubReceptionInput = z.infer<typeof clubReceptionSchema>;
