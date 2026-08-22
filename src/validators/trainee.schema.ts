import { z } from "zod";

export const traineeStatusEnum = z.enum(["ACTIVE", "ON_HOLD", "COMPLETED", "WITHDRAWN", "SUSPENDED", "GRADUATED"]);

export const createTraineeSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").max(100),
  lastName: z.string().trim().min(1, "Last name is required.").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z
    .string()
    .min(10, "Password must be at least 10 characters.")
    .max(200)
    .regex(/[A-Z]/, "Password must contain an uppercase letter.")
    .regex(/[a-z]/, "Password must contain a lowercase letter.")
    .regex(/[0-9]/, "Password must contain a number."),
  studentNumber: z.string().trim().min(1, "Student number is required.").max(30),
  programId: z.string().trim().optional().or(z.literal("")),
  batchId: z.string().trim().optional().or(z.literal("")),
  instructorId: z.string().trim().optional().or(z.literal("")),
});
export type CreateTraineeInput = z.infer<typeof createTraineeSchema>;

export const updateTraineeSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  studentNumber: z.string().trim().min(1).max(30).optional(),
  programId: z.string().trim().optional().or(z.literal("")),
  batchId: z.string().trim().optional().or(z.literal("")),
  instructorId: z.string().trim().optional().or(z.literal("")),
  status: traineeStatusEnum.optional(),
});
export type UpdateTraineeInput = z.infer<typeof updateTraineeSchema>;

export const attendanceStatusEnum = z.enum(["PRESENT", "LATE", "ABSENT", "EXCUSED"]);

export const recordAttendanceSchema = z.object({
  date: z.string().trim().refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date."),
  status: attendanceStatusEnum,
  remarks: z.string().trim().max(300).optional().or(z.literal("")),
});
export type RecordAttendanceInput = z.infer<typeof recordAttendanceSchema>;
