import "server-only";
import type { AttendanceStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { recordAttendance } from "@/services/trainee.service";

type ActorContext = { userId: string; role: string | null; ipAddress?: string | null; userAgent?: string | null };

function startOfDay(dateStr: string) {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return d;
}

export type AttendanceFilters = {
  batchId?: string;
  instructorId?: string;
  search?: string;
};

export async function getAttendanceRoster(dateStr: string, filters: AttendanceFilters = {}) {
  const day = startOfDay(dateStr);

  const where: Prisma.TraineeWhereInput = {
    deletedAt: null,
    status: "ACTIVE",
    ...(filters.batchId ? { batchId: filters.batchId } : {}),
    ...(filters.instructorId ? { instructorId: filters.instructorId } : {}),
    ...(filters.search
      ? {
          OR: [
            { studentNumber: { contains: filters.search, mode: "insensitive" } },
            { user: { firstName: { contains: filters.search, mode: "insensitive" } } },
            { user: { lastName: { contains: filters.search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const trainees = await prisma.trainee.findMany({
    where,
    include: {
      user: { select: { firstName: true, lastName: true } },
      batch: { select: { code: true } },
      instructor: { select: { user: { select: { firstName: true, lastName: true } } } },
      attendance: { where: { date: day }, take: 1 },
    },
    orderBy: { user: { firstName: "asc" } },
  });

  return trainees.map((t) => ({
    id: t.id,
    studentNumber: t.studentNumber,
    name: `${t.user.firstName} ${t.user.lastName}`,
    batch: t.batch?.code ?? null,
    instructor: t.instructor ? `${t.instructor.user.firstName} ${t.instructor.user.lastName}` : null,
    status: t.attendance[0]?.status ?? null,
    remarks: t.attendance[0]?.remarks ?? null,
  }));
}

export async function getAttendanceKpis(dateStr: string) {
  const day = startOfDay(dateStr);
  const [present, late, absent, excused, totalActive] = await Promise.all([
    prisma.attendance.count({ where: { date: day, status: "PRESENT" } }),
    prisma.attendance.count({ where: { date: day, status: "LATE" } }),
    prisma.attendance.count({ where: { date: day, status: "ABSENT" } }),
    prisma.attendance.count({ where: { date: day, status: "EXCUSED" } }),
    prisma.trainee.count({ where: { deletedAt: null, status: "ACTIVE" } }),
  ]);

  const marked = present + late + absent + excused;
  const attendanceRate = marked > 0 ? Math.round(((present + late) / marked) * 100) : 0;

  return { present, late, absent, excused, totalActive, attendanceRate };
}

export async function getRecentAttendanceActivity(limit = 8) {
  return prisma.auditLog.findMany({
    where: { action: "ATTENDANCE_RECORDED" },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { firstName: true, lastName: true } } },
  });
}

export async function bulkRecordAttendance(
  dateStr: string,
  entries: { traineeId: string; status: AttendanceStatus; remarks?: string }[],
  actor: ActorContext
) {
  const results = [];
  for (const entry of entries) {
    results.push(await recordAttendance(entry.traineeId, dateStr, entry.status, entry.remarks, actor));
  }
  return results;
}

export async function getMonthlyAttendance(traineeId: string, year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return prisma.attendance.findMany({
    where: { traineeId, date: { gte: start, lte: end } },
    orderBy: { date: "asc" },
  });
}
