import { Prisma } from "@prisma/client";

import { AppError } from "@/lib/errors";
import { apiError, apiServerError } from "@/lib/api-response";

/**
 * A P2002 unique-constraint violation reaching here means two concurrent
 * requests both passed a service's own "does this already exist" check
 * before either committed (e.g. double-clicking Register, two browser tabs,
 * or a retried request) — the constraint itself is what actually stopped the
 * duplicate write. Mapped to the same friendly, already-exists message a
 * service's own explicit check would have thrown, instead of falling through
 * to a raw 500. Each entry's `target` matches Prisma's `meta.target` for that
 * constraint (the column list, or the DB index name depending on the
 * database) — add to this list as other unique constraints need the same
 * race-safe handling.
 */
const UNIQUE_CONSTRAINT_MESSAGES: Array<{ target: string; message: string; code: string }> = [
  {
    target: "guestId",
    message: "Guest is already an Active Club Member.",
    code: "MEMBERSHIP_ALREADY_EXISTS",
  },
];

function friendlyUniqueConstraintError(err: Prisma.PrismaClientKnownRequestError) {
  const target = err.meta?.target;
  const targets = Array.isArray(target) ? target.map(String) : typeof target === "string" ? [target] : [];
  return UNIQUE_CONSTRAINT_MESSAGES.find((m) => targets.some((t) => t.toLowerCase().includes(m.target.toLowerCase())));
}

/** Route-handler catch-block helper: maps a known AppError to its structured status/code, logs and masks anything else. */
export function handleServiceError(err: unknown, logContext: string) {
  if (err instanceof AppError) return apiError(err.message, err.code, err.status);
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    const known = friendlyUniqueConstraintError(err);
    if (known) return apiError(known.message, known.code, 409);
  }
  console.error(`[${logContext}]`, err);
  return apiServerError();
}
