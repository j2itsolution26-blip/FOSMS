import { z } from "zod";

import { attendanceStatusEnum } from "@/validators/trainee.schema";

export const bulkAttendanceEntrySchema = z.object({
  traineeId: z.string().min(1),
  status: attendanceStatusEnum,
  remarks: z.string().trim().max(300).optional().or(z.literal("")),
});

export const bulkAttendanceSchema = z.object({
  date: z.string().trim().refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date."),
  entries: z.array(bulkAttendanceEntrySchema).min(1, "At least one entry is required."),
});
export type BulkAttendanceInput = z.infer<typeof bulkAttendanceSchema>;
