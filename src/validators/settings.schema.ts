import { z } from "zod";

export const settingsSchema = z.object({
  orgName: z.string().trim().min(1, "Organization name is required.").max(150),
  contactEmail: z.string().trim().toLowerCase().email("Enter a valid email address.").optional().or(z.literal("")),
  supportPhone: z.string().trim().max(30).optional().or(z.literal("")),
  dateFormat: z.enum(["MMM D, YYYY", "MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"]).default("MMM D, YYYY"),
});
export type SettingsInput = z.infer<typeof settingsSchema>;
