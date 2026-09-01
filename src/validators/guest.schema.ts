import { z } from "zod";

export const identificationTypeEnum = z.enum(["PASSPORT", "DRIVER_LICENSE", "NATIONAL_ID", "OTHER"]);

export const guestSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").max(100),
  middleName: z.string().trim().max(100).optional().or(z.literal("")),
  lastName: z.string().trim().min(1, "Last name is required.").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  identificationType: identificationTypeEnum.optional(),
  identificationNo: z.string().trim().max(60).optional().or(z.literal("")),
  nationality: z.string().trim().max(80).optional().or(z.literal("")),
  dateOfBirth: z.string().trim().optional().or(z.literal("")),
  preferences: z.string().trim().max(500).optional().or(z.literal("")),
  emergencyContact: z.string().trim().max(200).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  processedBy: z.string().trim().min(1, "Processed By is required.").max(150, "Processed By must be 150 characters or fewer."),
});

export type GuestInput = z.infer<typeof guestSchema>;
