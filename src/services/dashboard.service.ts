import "server-only";
import { prisma } from "@/lib/prisma";

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export async function getCompetencyOverview() {
  const competencies = await prisma.competency.findMany({
    where: { status: "ACTIVE" },
    orderBy: { displayOrder: "asc" },
    include: { traineeProgress: { select: { progress: true } } },
  });

  return competencies.map((c) => {
    const progressValues = c.traineeProgress.map((p) => p.progress);
    const avgProgress = progressValues.length
      ? Math.round(progressValues.reduce((sum, p) => sum + p, 0) / progressValues.length)
      : 0;
    return { id: c.id, code: c.code, title: c.title, progress: avgProgress };
  });
}

export type TodayActivity = {
  id: string;
  type: "ARRIVAL" | "DEPARTURE" | "NEW_RESERVATION";
  time: Date;
  label: string;
};

export async function getTodaysActivities(): Promise<TodayActivity[]> {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const [arrivals, departures, created] = await Promise.all([
    prisma.reservation.findMany({
      where: { arrivalDate: { gte: todayStart, lte: todayEnd }, status: { in: ["CONFIRMED", "CHECKED_IN"] } },
      include: { guest: { select: { firstName: true, lastName: true } }, room: { select: { number: true } } },
      take: 10,
    }),
    prisma.reservation.findMany({
      where: { departureDate: { gte: todayStart, lte: todayEnd }, status: "CHECKED_IN" },
      include: { guest: { select: { firstName: true, lastName: true } }, room: { select: { number: true } } },
      take: 10,
    }),
    prisma.reservation.findMany({
      where: { createdAt: { gte: todayStart, lte: todayEnd } },
      include: { guest: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const activities: TodayActivity[] = [
    ...arrivals.map((r) => ({
      id: `arr-${r.id}`,
      type: "ARRIVAL" as const,
      time: r.arrivalDate,
      label: `Check-in: ${r.guest.firstName} ${r.guest.lastName} (Rm ${r.room.number})`,
    })),
    ...departures.map((r) => ({
      id: `dep-${r.id}`,
      type: "DEPARTURE" as const,
      time: r.departureDate,
      label: `Check-out: ${r.guest.firstName} ${r.guest.lastName} (Rm ${r.room.number})`,
    })),
    ...created.map((r) => ({
      id: `new-${r.id}`,
      type: "NEW_RESERVATION" as const,
      time: r.createdAt,
      label: `Reservation ${r.reservationNo}: ${r.guest.firstName} ${r.guest.lastName}`,
    })),
  ];

  return activities.sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 8);
}

export async function getTrainingProgramKpis() {
  const [totalTrainees, activeTrainees, pendingAssessments, systemUsers] = await Promise.all([
    prisma.trainee.count({ where: { deletedAt: null } }),
    prisma.trainee.count({ where: { deletedAt: null, status: "ACTIVE" } }),
    prisma.assessment.count({ where: { status: { in: ["SCHEDULED", "IN_PROGRESS", "SUBMITTED", "UNDER_REVIEW"] } } }),
    prisma.user.count({ where: { deletedAt: null, isActive: true, trainee: null } }),
  ]);

  return { totalTrainees, activeTrainees, pendingAssessments, systemUsers };
}

export async function getDashboardSummary() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const [
    todaysArrivals,
    todaysDepartures,
    inHouseGuests,
    reservationsToday,
    roomStatusGroups,
    recentReservations,
  ] = await Promise.all([
    prisma.reservation.count({
      where: {
        arrivalDate: { gte: todayStart, lte: todayEnd },
        status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] },
      },
    }),
    prisma.reservation.count({
      where: {
        departureDate: { gte: todayStart, lte: todayEnd },
        status: "CHECKED_IN",
      },
    }),
    prisma.reservation.count({ where: { status: "CHECKED_IN" } }),
    prisma.reservation.count({ where: { createdAt: { gte: todayStart, lte: todayEnd } } }),
    prisma.room.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.reservation.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { guest: { select: { firstName: true, lastName: true } } },
    }),
  ]);

  const totalRooms = roomStatusGroups.reduce((sum, g) => sum + g._count._all, 0);
  const roomStatus = Object.fromEntries(roomStatusGroups.map((g) => [g.status, g._count._all]));

  // Last 7 days reservation trend (new reservations vs check-ins), for the dashboard line chart.
  const sevenDaysAgo = startOfDay(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));
  const [newInWindow, checkInsInWindow] = await Promise.all([
    prisma.reservation.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true },
    }),
    prisma.checkIn.findMany({
      where: { checkedInAt: { gte: sevenDaysAgo } },
      select: { checkedInAt: true },
    }),
  ]);

  const days: { date: string; label: string; newReservations: number; checkIns: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    days.push({
      date: key,
      label: d.toLocaleDateString("en-US", { weekday: "short" }),
      newReservations: 0,
      checkIns: 0,
    });
  }
  const dayIndex = new Map(days.map((d, i) => [d.date, i]));
  for (const r of newInWindow) {
    const key = r.createdAt.toISOString().slice(0, 10);
    const idx = dayIndex.get(key);
    if (idx !== undefined) days[idx].newReservations += 1;
  }
  for (const c of checkInsInWindow) {
    const key = c.checkedInAt.toISOString().slice(0, 10);
    const idx = dayIndex.get(key);
    if (idx !== undefined) days[idx].checkIns += 1;
  }

  return {
    kpis: {
      todaysArrivals,
      inHouseGuests,
      todaysDepartures,
      reservationsToday,
    },
    roomStatus: { total: totalRooms, byStatus: roomStatus },
    recentReservations: recentReservations.map((r) => ({
      id: r.id,
      reservationNo: r.reservationNo,
      guestName: `${r.guest.firstName} ${r.guest.lastName}`,
      arrivalDate: r.arrivalDate,
      status: r.status,
    })),
    trend: days,
  };
}
