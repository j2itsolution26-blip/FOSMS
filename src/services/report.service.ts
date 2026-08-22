import "server-only";
import { prisma } from "@/lib/prisma";
import { getRoomOccupancySummary } from "@/services/room.service";
import { toCsv } from "@/lib/csv";
import { recordAudit } from "@/lib/audit";

export const REPORT_TYPES = [
  { value: "trainee-master-list", label: "Trainee Master List", category: "Training" },
  { value: "training-progress", label: "Training Progress", category: "Training" },
  { value: "competency-completion", label: "Competency Completion", category: "Training" },
  { value: "assessment-summary", label: "Assessment Summary", category: "Assessment" },
  { value: "competent-trainees", label: "Competent Trainees", category: "Assessment" },
  { value: "not-yet-competent", label: "Not Yet Competent", category: "Assessment" },
  { value: "reservations", label: "Reservations", category: "Operational" },
  { value: "room-occupancy", label: "Room Occupancy", category: "Operational" },
] as const;

export type ReportType = (typeof REPORT_TYPES)[number]["value"];

const ASSESSMENT_STATUSES = ["SCHEDULED", "IN_PROGRESS", "SUBMITTED", "UNDER_REVIEW", "COMPLETED", "CANCELLED"] as const;
const RESERVATION_STATUSES = ["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED", "NO_SHOW"] as const;

type ReportFilters = {
  dateFrom?: string;
  dateTo?: string;
  competencyId?: string;
  batchId?: string;
  status?: string;
  assessorId?: string;
};

export async function previewReportCsv(type: ReportType, filters: ReportFilters, actor: { userId: string; role: string | null }) {
  const csv = await buildReportCsv(type, filters);

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "REPORT_GENERATED",
    module: "reports",
    newValue: { type, filters },
  });

  return csv;
}

export async function exportReportCsv(type: ReportType, filters: ReportFilters, actor: { userId: string; role: string | null }) {
  const csv = await buildReportCsv(type, filters);

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "REPORT_EXPORTED",
    module: "reports",
    newValue: { type, filters },
  });

  return csv;
}

async function buildReportCsv(type: ReportType, filters: ReportFilters): Promise<string> {
  const dateRange =
    filters.dateFrom || filters.dateTo
      ? {
          ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
          ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
        }
      : undefined;

  switch (type) {
    case "training-progress": {
      const rows = await prisma.traineeCompetency.findMany({
        where: { ...(filters.competencyId ? { competencyId: filters.competencyId } : {}) },
        include: {
          trainee: { include: { user: { select: { firstName: true, lastName: true } } } },
          competency: { select: { title: true, code: true } },
        },
        orderBy: [{ trainee: { studentNumber: "asc" } }],
      });
      return toCsv(
        ["Student Number", "Trainee", "Competency", "Status", "Progress %"],
        rows.map((r) => [
          r.trainee.studentNumber,
          `${r.trainee.user.firstName} ${r.trainee.user.lastName}`,
          `${r.competency.code} — ${r.competency.title}`,
          r.status,
          r.progress,
        ])
      );
    }

    case "competency-completion": {
      const competencies = await prisma.competency.findMany({
        orderBy: { displayOrder: "asc" },
        include: { traineeProgress: true },
      });
      return toCsv(
        ["Code", "Title", "Trainees", "Competent", "In Progress", "For Assessment", "Completion %"],
        competencies.map((c) => {
          const trainees = c.traineeProgress.length;
          const competent = c.traineeProgress.filter((t) => t.status === "COMPETENT" || t.status === "COMPLETED").length;
          const inProgress = c.traineeProgress.filter((t) => t.status === "IN_PROGRESS").length;
          const forAssessment = c.traineeProgress.filter((t) => t.status === "FOR_ASSESSMENT").length;
          const completion = trainees ? Math.round(c.traineeProgress.reduce((s, t) => s + t.progress, 0) / trainees) : 0;
          return [c.code, c.title, trainees, competent, inProgress, forAssessment, completion];
        })
      );
    }

    case "assessment-summary":
    case "competent-trainees":
    case "not-yet-competent": {
      const resultFilter =
        type === "competent-trainees" ? "COMPETENT" : type === "not-yet-competent" ? "NOT_YET_COMPETENT" : undefined;
      const rows = await prisma.assessment.findMany({
        where: {
          ...(resultFilter ? { result: resultFilter } : {}),
          ...(filters.competencyId ? { competencyId: filters.competencyId } : {}),
          ...(filters.assessorId ? { assessorId: filters.assessorId } : {}),
          ...(filters.status && ASSESSMENT_STATUSES.includes(filters.status as (typeof ASSESSMENT_STATUSES)[number])
            ? { status: filters.status as (typeof ASSESSMENT_STATUSES)[number] }
            : {}),
          ...(dateRange ? { createdAt: dateRange } : {}),
        },
        include: {
          trainee: { include: { user: { select: { firstName: true, lastName: true } } } },
          competency: { select: { title: true, code: true } },
          assessor: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      return toCsv(
        ["Assessment #", "Trainee", "Competency", "Assessor", "Status", "Result", "Date"],
        rows.map((r) => [
          r.assessmentNo,
          `${r.trainee.user.firstName} ${r.trainee.user.lastName}`,
          `${r.competency.code} — ${r.competency.title}`,
          `${r.assessor.firstName} ${r.assessor.lastName}`,
          r.status,
          r.result,
          r.createdAt.toISOString().slice(0, 10),
        ])
      );
    }

    case "reservations": {
      const rows = await prisma.reservation.findMany({
        where: {
          ...(dateRange ? { createdAt: dateRange } : {}),
          ...(filters.status && RESERVATION_STATUSES.includes(filters.status as (typeof RESERVATION_STATUSES)[number])
            ? { status: filters.status as (typeof RESERVATION_STATUSES)[number] }
            : {}),
        },
        include: { guest: true, room: { include: { roomType: true } } },
        orderBy: { createdAt: "desc" },
        take: 1000,
      });
      return toCsv(
        ["Reservation #", "Guest", "Room", "Room Type", "Arrival", "Departure", "Status", "Source"],
        rows.map((r) => [
          r.reservationNo,
          `${r.guest.firstName} ${r.guest.lastName}`,
          r.room.number,
          r.room.roomType.name,
          r.arrivalDate.toISOString().slice(0, 10),
          r.departureDate.toISOString().slice(0, 10),
          r.status,
          r.source,
        ])
      );
    }

    case "room-occupancy": {
      const rooms = await prisma.room.findMany({ include: { roomType: true }, orderBy: [{ floor: "asc" }, { number: "asc" }] });
      return toCsv(
        ["Room", "Floor", "Type", "Status"],
        rooms.map((r) => [r.number, r.floor, r.roomType.name, r.status])
      );
    }

    case "trainee-master-list":
    default: {
      const { exportTraineesCsv } = await import("@/services/trainee.service");
      return exportTraineesCsv({ batchId: filters.batchId });
    }
  }
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getAnalyticsKpis() {
  const [totalTrainees, competencyAgg, assessmentCompleted, assessmentTotal, competentCount, attendanceRows, activeReservations, roomOccupancy] =
    await Promise.all([
      prisma.trainee.count({ where: { deletedAt: null } }),
      prisma.traineeCompetency.aggregate({ _avg: { progress: true } }),
      prisma.assessment.count({ where: { status: "COMPLETED" } }),
      prisma.assessment.count(),
      prisma.assessment.count({ where: { status: "COMPLETED", result: "COMPETENT" } }),
      prisma.attendance.findMany({ where: { date: { gte: daysAgo(30) } }, select: { status: true } }),
      prisma.reservation.count({ where: { status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] } } }),
      getRoomOccupancySummary(),
    ]);

  const attendanceRate = attendanceRows.length
    ? Math.round((attendanceRows.filter((a) => a.status === "PRESENT" || a.status === "LATE").length / attendanceRows.length) * 100)
    : 0;
  const occupancyRate = roomOccupancy.total
    ? Math.round(((roomOccupancy.byStatus.OCCUPIED ?? 0) / roomOccupancy.total) * 100)
    : 0;

  return {
    totalTrainees,
    competencyCompletion: Math.round(competencyAgg._avg.progress ?? 0),
    competentRate: assessmentCompleted > 0 ? Math.round((competentCount / assessmentCompleted) * 100) : 0,
    assessmentCompletion: assessmentTotal > 0 ? Math.round((assessmentCompleted / assessmentTotal) * 100) : 0,
    attendanceRate,
    activeReservations,
    roomOccupancyRate: occupancyRate,
  };
}

export async function getCompetencyCompletionChart() {
  const competencies = await prisma.competency.findMany({
    where: { status: "ACTIVE" },
    orderBy: { displayOrder: "asc" },
    include: { traineeProgress: { select: { progress: true } } },
  });

  return competencies.map((c) => ({
    code: c.code,
    title: c.title,
    completion: c.traineeProgress.length
      ? Math.round(c.traineeProgress.reduce((sum, p) => sum + p.progress, 0) / c.traineeProgress.length)
      : 0,
  }));
}

export async function getAssessmentResultsChart() {
  const [grouped, openCount] = await Promise.all([
    prisma.assessment.groupBy({ by: ["result"], where: { status: "COMPLETED" }, _count: { _all: true } }),
    prisma.assessment.count({ where: { status: { in: ["SCHEDULED", "IN_PROGRESS", "SUBMITTED", "UNDER_REVIEW"] } } }),
  ]);
  const byResult = Object.fromEntries(grouped.map((g) => [g.result, g._count._all]));

  return {
    competent: byResult.COMPETENT ?? 0,
    notYetCompetent: byResult.NOT_YET_COMPETENT ?? 0,
    pending: openCount,
  };
}

export async function getTrainingStatusChart() {
  const grouped = await prisma.trainee.groupBy({ by: ["status"], where: { deletedAt: null }, _count: { _all: true } });
  return grouped.map((g) => ({ status: g.status, count: g._count._all }));
}

export async function getAttendanceTrendChart(days = 14) {
  const start = daysAgo(days - 1);
  const rows = await prisma.attendance.findMany({ where: { date: { gte: start } }, select: { date: true, status: true } });

  const byDay = new Map<string, { present: number; total: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    byDay.set(d.toISOString().slice(0, 10), { present: 0, total: 0 });
  }
  for (const row of rows) {
    const key = row.date.toISOString().slice(0, 10);
    const bucket = byDay.get(key);
    if (!bucket) continue;
    bucket.total += 1;
    if (row.status === "PRESENT" || row.status === "LATE") bucket.present += 1;
  }

  return Array.from(byDay.entries()).map(([date, { present, total }]) => ({
    date,
    label: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    attendanceRate: total > 0 ? Math.round((present / total) * 100) : 0,
  }));
}

export async function getReservationTrendChart(days = 14) {
  const start = daysAgo(days - 1);
  const [reservations, cancellations, noShows] = await Promise.all([
    prisma.reservation.findMany({ where: { createdAt: { gte: start } }, select: { createdAt: true } }),
    prisma.reservation.findMany({ where: { status: "CANCELLED", updatedAt: { gte: start } }, select: { updatedAt: true } }),
    prisma.reservation.findMany({ where: { status: "NO_SHOW", updatedAt: { gte: start } }, select: { updatedAt: true } }),
  ]);

  const byDay = new Map<string, { confirmed: number; cancelled: number; noShow: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    byDay.set(d.toISOString().slice(0, 10), { confirmed: 0, cancelled: 0, noShow: 0 });
  }
  for (const r of reservations) {
    const bucket = byDay.get(r.createdAt.toISOString().slice(0, 10));
    if (bucket) bucket.confirmed += 1;
  }
  for (const r of cancellations) {
    const bucket = byDay.get(r.updatedAt.toISOString().slice(0, 10));
    if (bucket) bucket.cancelled += 1;
  }
  for (const r of noShows) {
    const bucket = byDay.get(r.updatedAt.toISOString().slice(0, 10));
    if (bucket) bucket.noShow += 1;
  }

  return Array.from(byDay.entries()).map(([date, v]) => ({
    date,
    label: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    ...v,
  }));
}

export async function getOccupancyChart() {
  return getRoomOccupancySummary();
}

export async function getFrontOfficeActivityChart(days = 14) {
  const start = daysAgo(days - 1);
  const [checkIns, checkOuts, transfers, requests] = await Promise.all([
    prisma.checkIn.count({ where: { checkedInAt: { gte: start } } }),
    prisma.checkOut.count({ where: { checkedOutAt: { gte: start } } }),
    prisma.auditLog.count({ where: { action: "ROOM_TRANSFER", createdAt: { gte: start } } }),
    prisma.serviceRequest.count({ where: { createdAt: { gte: start } } }),
  ]);
  return { checkIns, checkOuts, transfers, requests };
}

export async function getCashieringChart(days = 14) {
  const start = daysAgo(days - 1);
  const grouped = await prisma.cashierTransaction.groupBy({
    by: ["type"],
    where: { createdAt: { gte: start } },
    _sum: { amount: true },
    _count: { _all: true },
  });
  const byMethod = await prisma.cashierTransaction.groupBy({
    by: ["paymentMethod"],
    where: { createdAt: { gte: start }, type: "PAYMENT" },
    _sum: { amount: true },
  });

  return {
    byType: grouped.map((g) => ({ type: g.type, amount: Number(g._sum.amount ?? 0), count: g._count._all })),
    byMethod: byMethod
      .filter((m) => m.paymentMethod)
      .map((m) => ({ method: m.paymentMethod, amount: Number(m._sum.amount ?? 0) })),
  };
}
