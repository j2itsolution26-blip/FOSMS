import { z } from "zod";

export const submitActivitySchema = z.object({
  remarks: z.string().trim().max(2000).optional(),
});

export type SubmitActivityInput = z.infer<typeof submitActivitySchema>;
