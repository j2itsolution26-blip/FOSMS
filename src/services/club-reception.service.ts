import "server-only";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { NotFoundError, AppError } from "@/lib/errors";
import { countActiveClubMembers } from "@/services/club-membership.service";
import { normalizeNameKey } from "@/lib/guest-identity";
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

  const [todaysVisitorEntries, activeMembers, todaysActivities] = await Promise.all([
    // Visitors who actually signed in at the club TODAY — real ClubReception
    // rows, never memberships that merely exist. Grouped instead of counted so
    // one person who signs in, leaves, and signs in again the same day is one
    // visitor and not three (the reception log genuinely holds repeat same-day
    // entries for the same guest). Date window is derived from the server clock
    // at request time, so it rolls over on its own — no date is ever hardcoded.
    prisma.clubReception.groupBy({
      by: ["guestName", "memberNumber"],
      where: { isVisitor: true, checkedInAt: { gte: todayStart, lte: todayEnd } },
    }),
    // Real ACTIVE Club Memberships — the same records (and the same "fee paid
    // and never reversed" rule) the Club Members table lists, so this card can
    // never disagree with it. This used to count ClubReception sign-in rows
    // marked "not a visitor" and not yet checked out, which is a completely
    // different dataset: a reception log entry is a person physically in the
    // club today, not a registered membership, so a property with 3 active
    // members and 1 member signed in reported "1".
    countActiveClubMembers(),
    // Every reception action recorded today, read from the SAME audit trail the
    // "Recent Activity" list on this page renders (module "club-reception"), so
    // the number and the list can never disagree. One row per real action —
    // visitor/guest registration, club member registration, check-out — written
    // at the moment the action happens, so nothing is inferred or duplicated.
    // The old query counted only ClubReception check-ins, which silently
    // dropped club membership registrations and check-outs done the same day.
    prisma.auditLog.count({
      where: { module: "club-reception", createdAt: { gte: todayStart, lte: todayEnd } },
    }),
  ]);

  // One entry per distinct person: prefer their membership/visitor number when
  // the desk recorded one (two different people can share a name), otherwise
  // fall back to an order- and case-insensitive name key.
  const todaysVisitors = new Set(
    todaysVisitorEntries.map((entry) =>
      entry.memberNumber?.trim()
        ? `id:${entry.memberNumber.trim().toLowerCase()}`
        : `name:${normalizeNameKey(entry.guestName)}`
    )
  ).size;

  // This module has no request entity of its own. ServiceRequest is the
  // Concierge module's table — its types are concierge services (luggage,
  // transportation, wake-up call, tour…), it carries no club scope, and Club
  // Reception no longer has any screen that creates or works one. Counting it
  // here made this card mirror the Concierge backlog (22 rows, mostly test
  // data) as if the club had 22 outstanding items, so it is reported as 0
  // rather than being filled with an unrelated table's records.
  const pendingRequests = 0;

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
