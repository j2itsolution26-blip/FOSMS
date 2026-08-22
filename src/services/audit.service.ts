import "server-only";
import type { AuditAction, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { PaginationInput } from "@/validators/pagination.schema";
import { paginationMeta } from "@/validators/pagination.schema";

export type AuditLogFilters = {
  module?: string;
  action?: AuditAction;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
};

/** Recent audit trail for a module's activity feed (Front Office, Club Reception, Concierge, Cashiering, ...). */
export async function getRecentModuleActivity(module: string, limit = 8) {
  return prisma.auditLog.findMany({
    where: { module },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { firstName: true, lastName: true } } },
  });
}

export async function listAuditLogs(pagination: PaginationInput, filters: AuditLogFilters = {}) {
  const { page, pageSize, search } = pagination;

  const where: Prisma.AuditLogWhereInput = {
    ...(filters.module ? { module: filters.module } : {}),
    ...(filters.action ? { action: filters.action } : {}),
    ...(filters.userId ? { userId: filters.userId } : {}),
    ...(filters.dateFrom || filters.dateTo
      ? {
          createdAt: {
            ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
            ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { module: { contains: search, mode: "insensitive" } },
            { recordId: { contains: search, mode: "insensitive" } },
            { user: { email: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { rows, meta: paginationMeta(total, { page, pageSize }) };
}
