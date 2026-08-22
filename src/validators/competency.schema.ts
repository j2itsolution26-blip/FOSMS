import { z } from "zod";

export const competencySchema = z.object({
  code: z.string().trim().min(1, "Code is required.").max(20),
  title: z.string().trim().min(1, "Title is required.").max(200),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  learningOutcomes: z.string().trim().max(2000).optional().or(z.literal("")),
  performanceCriteria: z.string().trim().max(2000).optional().or(z.literal("")),
  requiredActivities: z.string().trim().max(2000).optional().or(z.literal("")),
  assessmentCriteria: z.string().trim().max(2000).optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  displayOrder: z.coerce.number().int().min(0).max(1000).default(0),
});

export type CompetencyInput = z.infer<typeof competencySchema>;
