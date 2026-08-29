import { z } from "zod";
import type { RoomStatus } from "@prisma/client";

import { ROOM_STATUS_ORDER } from "@/config/room-status";

export const roomStatusEnum = z.enum(ROOM_STATUS_ORDER as [RoomStatus, ...RoomStatus[]]);

export const roomTypeSchema = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  baseRate: z.coerce.number().positive("Base rate must be greater than 0."),
  maxOccupancy: z.coerce.number().int().min(1).max(20),
});

export type RoomTypeInput = z.infer<typeof roomTypeSchema>;

export const roomSchema = z.object({
  number: z.string().trim().min(1, "Room number is required.").max(20),
  roomTypeId: z.string().min(1, "Room type is required."),
  floor: z.coerce.number().int().min(0).max(200),
  status: roomStatusEnum.optional(),
});

export type RoomInput = z.infer<typeof roomSchema>;

export const roomStatusUpdateSchema = z.object({
  status: roomStatusEnum,
  note: z.string().trim().max(300).optional(),
});
