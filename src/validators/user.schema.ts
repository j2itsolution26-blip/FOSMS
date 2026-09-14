import { z } from "zod";

/**
 * The one password policy every account in the system is held to — new users
 * here, and both password-management flows in account.schema.ts (a
 * Supervisor changing their own password, and a Supervisor resetting a
 * trainee's). Defined once so the rules can never drift between the place an
 * account is created and the places its password is later replaced.
 */
export const strongPasswordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters.")
  .max(200)
  .regex(/[A-Z]/, "Password must contain an uppercase letter.")
  .regex(/[a-z]/, "Password must contain a lowercase letter.")
  .regex(/[0-9]/, "Password must contain a number.");

export const createUserSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").max(100),
  lastName: z.string().trim().min(1, "Last name is required.").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: strongPasswordSchema,
  roleId: z.string().min(1, "Role is required."),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
  roleId: z.string().min(1).optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
