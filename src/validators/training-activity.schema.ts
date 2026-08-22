import { z } from "zod";

export const createTrainingActivitySchema = z.object({
  instructorId: z.string().min(1, "Instructor is required."),
  competencyId: z.string().trim().optional().or(z.literal("")),
  title: z.string().trim().min(1, "Title is required.").max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  instructions: z.string().trim().max(5000).optional().or(z.literal("")),
  dueDate: z.string().trim().optional().or(z.literal("")),
});
export type CreateTrainingActivityInput = z.infer<typeof createTrainingActivitySchema>;

export const updateTrainingActivitySchema = z.object({
  instructorId: z.string().min(1).optional(),
  competencyId: z.string().trim().optional().or(z.literal("")),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  instructions: z.string().trim().max(5000).optional().or(z.literal("")),
  dueDate: z.string().trim().optional().or(z.literal("")),
});
export type UpdateTrainingActivityInput = z.infer<typeof updateTrainingActivitySchema>;

export const assignTraineesSchema = z.object({
  traineeIds: z.array(z.string().min(1)).min(1, "Select at least one trainee."),
});
export type AssignTraineesInput = z.infer<typeof assignTraineesSchema>;

export const gradeSubmissionSchema = z.object({
  score: z.coerce.number().int().min(0, "Score cannot be negative.").max(100, "Score cannot exceed 100."),
  remarks: z.string().trim().max(1000).optional().or(z.literal("")),
});
export type GradeSubmissionInput = z.infer<typeof gradeSubmissionSchema>;
