import { z } from "zod";

export const serviceRequestTypeEnum = z.enum([
  "LUGGAGE",
  "TRANSPORTATION",
  "WAKE_UP_CALL",
  "LOCAL_INFO",
  "RESTAURANT_RECOMMENDATION",
  "TOUR",
  "DELIVERY",
  "OTHER",
]);

export const serviceRequestPriorityEnum = z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]);
export const serviceRequestStatusEnum = z.enum(["PENDING", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]);

export const createServiceRequestSchema = z.object({
  type: serviceRequestTypeEnum.default("OTHER"),
  priority: serviceRequestPriorityEnum.default("NORMAL"),
  guestId: z.string().trim().optional().or(z.literal("")),
  roomNumber: z.string().trim().max(20).optional().or(z.literal("")),
  description: z.string().trim().min(1, "Description is required.").max(500),
});
export type CreateServiceRequestInput = z.infer<typeof createServiceRequestSchema>;

export const assignServiceRequestSchema = z.object({
  assignedToId: z.string().min(1, "Staff member is required."),
});
export type AssignServiceRequestInput = z.infer<typeof assignServiceRequestSchema>;

export const serviceRequestStatusUpdateSchema = z.object({
  status: serviceRequestStatusEnum,
});
