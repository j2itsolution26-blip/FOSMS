import { z } from "zod";

import { strongPasswordSchema } from "@/validators/user.schema";

/**
 * A user replacing their OWN password. The current password is only ever
 * checked against the stored hash (see changeOwnPassword in
 * account.service.ts) — it is never stored, echoed back, or logged.
 */
export const changeOwnPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: strongPasswordSchema,
    confirmPassword: z.string().min(1, "Re-enter the new password to confirm it."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "The new password and its confirmation do not match.",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "The new password must be different from your current password.",
    path: ["newPassword"],
  });

export type ChangeOwnPasswordInput = z.infer<typeof changeOwnPasswordSchema>;

/**
 * A Supervisor issuing a new temporary password for someone else's account.
 * There is deliberately no "current password" here — the Supervisor doesn't
 * know it and must never be shown it; authority comes from the USERS_MANAGE
 * permission the route checks, and the service re-checks that the target is
 * actually a trainee account.
 */
export const resetAccountPasswordSchema = z
  .object({
    newPassword: strongPasswordSchema,
    confirmPassword: z.string().min(1, "Re-enter the new password to confirm it."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "The new password and its confirmation do not match.",
    path: ["confirmPassword"],
  });

export type ResetAccountPasswordInput = z.infer<typeof resetAccountPasswordSchema>;

/** Supervisor activating / deactivating a Front Desk trainee login. */
export const staffAccountStatusSchema = z.object({
  status: z.enum(["ACTIVE", "DEACTIVATED"], { message: "Choose ACTIVE or DEACTIVATED." }),
});

export type StaffAccountStatusInput = z.infer<typeof staffAccountStatusSchema>;
