import { z } from "zod";

export const submitActivitySchema = z.object({
  remarks: z.string().trim().max(2000).optional(),
});

export const DOCUMENT_CATEGORIES = [
  "Activity Evidence",
  "Assessment Evidence",
  "Training Documents",
  "Certificates",
  "Other Documents",
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const uploadDocumentSchema = z.object({
  label: z.string().trim().min(1, "Document name is required.").max(200, "Document name is too long."),
  category: z.enum(DOCUMENT_CATEGORIES),
  description: z.string().trim().max(1000, "Description must be under 1000 characters.").optional(),
});

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;
