import { z } from "zod";

export const assessmentStatusEnum = z.enum(["SCHEDULED", "IN_PROGRESS", "SUBMITTED", "UNDER_REVIEW", "COMPLETED", "CANCELLED"]);
export const assessmentResultEnum = z.enum(["PENDING", "COMPETENT", "NOT_YET_COMPETENT"]);
export const evidenceTypeEnum = z.enum([
  "PRACTICAL_DEMONSTRATION",
  "OBSERVATION",
  "WRITTEN_WORK",
  "SIMULATION",
  "PERFORMANCE_EVIDENCE",
  "DOCUMENT",
]);

export const createAssessmentSchema = z.object({
  traineeId: z.string().min(1, "Trainee is required."),
  competencyId: z.string().min(1, "Competency is required."),
  assessorId: z.string().min(1, "Assessor is required."),
  scheduledDate: z.string().trim().optional().or(z.literal("")),
});
export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;

export const submitAssessmentSchema = z.object({
  observations: z.string().trim().max(2000).optional().or(z.literal("")),
  remarks: z.string().trim().max(1000).optional().or(z.literal("")),
  score: z.coerce.number().int().min(0).max(100).optional(),
});
export type SubmitAssessmentInput = z.infer<typeof submitAssessmentSchema>;

export const finalizeAssessmentSchema = z.object({
  result: z.enum(["COMPETENT", "NOT_YET_COMPETENT"]),
  remarks: z.string().trim().max(1000).optional().or(z.literal("")),
});
export type FinalizeAssessmentInput = z.infer<typeof finalizeAssessmentSchema>;

export const addEvidenceSchema = z.object({
  type: evidenceTypeEnum,
  description: z.string().trim().max(1000).optional().or(z.literal("")),
});
export type AddEvidenceInput = z.infer<typeof addEvidenceSchema>;
