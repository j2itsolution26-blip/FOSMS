import "server-only";
import { prisma } from "@/lib/prisma";
import type { AuditAction, Prisma } from "@prisma/client";

type AuditEntry = {
  userId?: string | null;
  role?: string | null;
  action: AuditAction;
  module: string;
  recordId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  previousValue?: Prisma.InputJsonValue | null;
  newValue?: Prisma.InputJsonValue | null;
  result?: string;
};

/**
 * Writes an audit trail row. Failures are logged but never thrown — an audit
 * write must not be able to roll back or block the business operation it is
 * describing (the operation already happened; losing the log entry is bad,
 * losing the reservation/payment because logging hiccuped is worse).
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        role: entry.role ?? null,
        action: entry.action,
        module: entry.module,
        recordId: entry.recordId ?? null,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
        previousValue: entry.previousValue ?? undefined,
        newValue: entry.newValue ?? undefined,
        result: entry.result ?? "SUCCESS",
      },
    });
  } catch (err) {
    console.error("[audit] failed to write audit log", entry.module, entry.action, err);
  }
}
