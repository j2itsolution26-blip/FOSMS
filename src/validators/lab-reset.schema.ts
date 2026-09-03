import { z } from "zod";

// Defense-in-depth: the UI already gates the button behind typing "RESET"
// and a second "are you sure" step, but this destructive, irreversible
// operation must never proceed on the strength of client-side validation
// alone — the server re-checks the exact confirmation word itself.
export const resetLaboratoryDataSchema = z.object({
  confirmation: z.literal("RESET", { message: 'Type "RESET" to confirm.' }),
});
export type ResetLaboratoryDataInput = z.infer<typeof resetLaboratoryDataSchema>;
