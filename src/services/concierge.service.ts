import "server-only";
import type { Prisma, ServiceRequestStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { NotFoundError, AppError } from "@/lib/errors";
import { nextNumber } from "@/lib/number-sequence";
import type { AssignServiceRequestInput, CreateServiceRequestInput } from "@/validators/concierge.schema";

type ActorContext = { userId: string; role: string | null; ipAddress?: string | null; userAgent?: string | null };

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

const OPEN_STATUSES: ServiceRequestStatus[] = ["PENDING", "ASSIGNED", "IN_PROGRESS"];

/** Lightweight staff list for the "assign to" picker — narrower than full user management. */
export async function listAssignableStaff() {
  return prisma.user.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true, firstName: true, lastName: true },
    orderBy: { firstName: "asc" },
  });
}

export async function getConciergeKpis() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const [pending, inProgress, completedToday, highPriority] = await Promise.all([
    prisma.serviceRequest.count({ where: { status: "PENDING" } }),
    prisma.serviceRequest.count({ where: { status: "IN_PROGRESS" } }),
    prisma.serviceRequest.count({ where: { status: "COMPLETED", completedAt: { gte: todayStart, lte: todayEnd } } }),
    prisma.serviceRequest.count({ where: { status: { in: OPEN_STATUSES }, priority: { in: ["HIGH", "URGENT"] } } }),
  ]);

  return { pending, inProgress, completedToday, highPriority };
}

export async function listServiceRequests(search = "") {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const searchLower = search.trim();

  const where: Prisma.ServiceRequestWhereInput = {
    OR: [{ status: { in: OPEN_STATUSES } }, { createdAt: { gte: todayStart, lte: todayEnd } }],
    ...(searchLower
      ? {
          AND: [
            {
              OR: [
                { requestNo: { contains: searchLower, mode: "insensitive" } },
                { description: { contains: searchLower, mode: "insensitive" } },
                { roomNumber: { contains: searchLower, mode: "insensitive" } },
                { guest: { firstName: { contains: searchLower, mode: "insensitive" } } },
                { guest: { lastName: { contains: searchLower, mode: "insensitive" } } },
              ],
            },
          ],
        }
      : {}),
  };

  return prisma.serviceRequest.findMany({
    where,
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    include: {
      guest: { select: { firstName: true, lastName: true } },
      assignedTo: { select: { firstName: true, lastName: true } },
    },
    take: 200,
  });
}

export async function createServiceRequest(input: CreateServiceRequestInput, actor: ActorContext) {
  const request = await prisma.$transaction(async (tx) => {
    const requestNo = await nextNumber(tx, "service-request", "SR");
    return tx.serviceRequest.create({
      data: {
        requestNo,
        type: input.type,
        priority: input.priority,
        guestId: input.guestId || null,
        roomNumber: input.roomNumber || null,
        description: input.description,
        createdById: actor.userId,
      },
    });
  });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "SERVICE_REQUEST_CREATED",
    module: "concierge",
    recordId: request.id,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    newValue: { requestNo: request.requestNo, type: request.type, description: request.description },
  });

  return request;
}

export async function assignServiceRequest(id: string, input: AssignServiceRequestInput, actor: ActorContext) {
  const existing = await prisma.serviceRequest.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Service request not found.");
  if (existing.status === "COMPLETED" || existing.status === "CANCELLED") {
    throw new AppError(`Cannot assign a request that is already ${existing.status.toLowerCase()}.`, "REQUEST_LOCKED", 409);
  }

  const request = await prisma.serviceRequest.update({
    where: { id },
    data: { assignedToId: input.assignedToId, status: existing.status === "PENDING" ? "ASSIGNED" : existing.status },
    include: { assignedTo: true },
  });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "SERVICE_REQUEST_ASSIGNED",
    module: "concierge",
    recordId: request.id,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    newValue: { requestNo: request.requestNo, assignedTo: `${request.assignedTo?.firstName} ${request.assignedTo?.lastName}` },
  });

  return request;
}

export async function updateServiceRequestStatus(id: string, status: ServiceRequestStatus, actor: ActorContext) {
  const existing = await prisma.serviceRequest.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Service request not found.");
  if (existing.status === "COMPLETED" || existing.status === "CANCELLED") {
    throw new AppError(`This request is already ${existing.status.toLowerCase()}.`, "REQUEST_LOCKED", 409);
  }

  const request = await prisma.serviceRequest.update({
    where: { id },
    data: { status, completedAt: status === "COMPLETED" ? new Date() : undefined },
  });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: status === "COMPLETED" ? "SERVICE_REQUEST_COMPLETED" : "UPDATE",
    module: "concierge",
    recordId: request.id,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    previousValue: { status: existing.status },
    newValue: { status },
  });

  return request;
}
