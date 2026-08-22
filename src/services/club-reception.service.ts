import "server-only";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { NotFoundError, AppError } from "@/lib/errors";
import type { ClubReceptionInput } from "@/validators/club-reception.schema";

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

export async function getClubReceptionKpis() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const [todaysVisitors, activeMembers, pendingRequests, todaysActivities] = await Promise.all([
    prisma.clubReception.count({
      where: { isVisitor: true, checkedInAt: { gte: todayStart, lte: todayEnd } },
    }),
    prisma.clubReception.count({ where: { isVisitor: false, checkedOutAt: null } }),
    prisma.serviceRequest.count({ where: { status: "PENDING" } }),
    prisma.clubReception.count({ where: { checkedInAt: { gte: todayStart, lte: todayEnd } } }),
  ]);

  return { todaysVisitors, activeMembers, pendingRequests, todaysActivities };
}

export async function listTodayReceptions(search = "") {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const searchLower = search.trim();

  return prisma.clubReception.findMany({
    where: {
      checkedInAt: { gte: todayStart, lte: todayEnd },
      ...(searchLower
        ? {
            OR: [
              { guestName: { contains: searchLower, mode: "insensitive" } },
              { memberNumber: { contains: searchLower, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { checkedInAt: "desc" },
    include: { registeredBy: { select: { firstName: true, lastName: true } } },
    take: 200,
  });
}

export async function createReception(input: ClubReceptionInput, actor: ActorContext) {
  const record = await prisma.clubReception.create({
    data: {
      guestName: input.guestName,
      memberNumber: input.memberNumber || null,
      isVisitor: input.isVisitor,
      purpose: input.purpose || null,
      registeredById: actor.userId,
    },
  });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "CLUB_REGISTRATION",
    module: "club-reception",
    recordId: record.id,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    newValue: { guestName: record.guestName, isVisitor: record.isVisitor, memberNumber: record.memberNumber },
  });

  return record;
}

export async function checkOutReception(id: string, actor: ActorContext) {
  const existing = await prisma.clubReception.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Reception record not found.");
  if (existing.checkedOutAt) {
    throw new AppError("This record is already checked out.", "ALREADY_CHECKED_OUT", 409);
  }

  const record = await prisma.clubReception.update({ where: { id }, data: { checkedOutAt: new Date() } });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "CLUB_CHECK_OUT",
    module: "club-reception",
    recordId: record.id,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    newValue: { guestName: record.guestName },
  });

  return record;
}
