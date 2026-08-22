import "server-only";
import type { Prisma, TraineeStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { recordAudit } from "@/lib/audit";
import { AppError, NotFoundError } from "@/lib/errors";
import { saveUploadedFile } from "@/lib/file-upload";
import { toCsv } from "@/lib/csv";
import type { CreateTraineeInput, UpdateTraineeInput } from "@/validators/trainee.schema";
import type { PaginationInput } from "@/validators/pagination.schema";
import { paginationMeta } from "@/validators/pagination.schema";
import type { AttendanceStatus } from "@prisma/client";

type ActorContext = { userId: string; role: string | null; ipAddress?: string | null; userAgent?: string | null };

export async function getTraineeKpis() {
  const [total, active, forAssessment, completed] = await Promise.all([
    prisma.trainee.count({ where: { deletedAt: null } }),
    prisma.trainee.count({ where: { deletedAt: null, status: "ACTIVE" } }),
    prisma.trainee.count({
      where: { deletedAt: null, competencies: { some: { status: "FOR_ASSESSMENT" } } },
    }),
    prisma.trainee.count({ where: { deletedAt: null, status: "COMPLETED" } }),
  ]);

  return { total, active, forAssessment, completed };
}

const listInclude = {
  user: { select: { firstName: true, lastName: true, email: true, phone: true, isActive: true } },
  batch: { select: { id: true, code: true } },
  instructor: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
  competencies: { select: { progress: true, status: true } },
} satisfies Prisma.TraineeInclude;

export type TraineeListFilters = {
  status?: TraineeStatus;
  batchId?: string;
  instructorId?: string;
  competencyProgress?: "under50" | "50to79" | "80plus";
};

export async function listTrainees(pagination: PaginationInput, filters: TraineeListFilters = {}) {
  const { page, pageSize, search, sortBy, sortDir } = pagination;

  // The progress-bucket filter depends on an aggregate across each trainee's
  // TraineeCompetency rows, so it's resolved to a concrete set of trainee IDs
  // *before* pagination — otherwise the count/pagination and the visible rows
  // would disagree (filtering post-query only affects the current page).
  let progressTraineeIds: string[] | undefined;
  if (filters.competencyProgress) {
    const grouped = await prisma.traineeCompetency.groupBy({ by: ["traineeId"], _avg: { progress: true } });
    progressTraineeIds = grouped
      .filter((g) => {
        const avg = g._avg.progress ?? 0;
        if (filters.competencyProgress === "under50") return avg < 50;
        if (filters.competencyProgress === "50to79") return avg >= 50 && avg < 80;
        return avg >= 80;
      })
      .map((g) => g.traineeId);
  }

  const where: Prisma.TraineeWhereInput = {
    deletedAt: null,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.batchId ? { batchId: filters.batchId } : {}),
    ...(filters.instructorId ? { instructorId: filters.instructorId } : {}),
    ...(progressTraineeIds ? { id: { in: progressTraineeIds } } : {}),
    ...(search
      ? {
          OR: [
            { studentNumber: { contains: search, mode: "insensitive" } },
            { user: { firstName: { contains: search, mode: "insensitive" } } },
            { user: { lastName: { contains: search, mode: "insensitive" } } },
            { user: { email: { contains: search, mode: "insensitive" } } },
            { user: { phone: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const sortableFields = new Set(["createdAt", "studentNumber", "status", "enrollmentDate"]);
  const orderBy: Prisma.TraineeOrderByWithRelationInput =
    sortBy && sortableFields.has(sortBy) ? { [sortBy]: sortDir } : { createdAt: "desc" };

  const [rows, total] = await Promise.all([
    prisma.trainee.findMany({ where, include: listInclude, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.trainee.count({ where }),
  ]);

  const withProgress = rows.map((t) => ({
    ...t,
    avgProgress: t.competencies.length
      ? Math.round(t.competencies.reduce((sum, c) => sum + c.progress, 0) / t.competencies.length)
      : 0,
  }));

  return { rows: withProgress, meta: paginationMeta(total, { page, pageSize }) };
}

export async function getTraineeById(id: string) {
  const trainee = await prisma.trainee.findUnique({
    where: { id, deletedAt: null },
    include: {
      user: true,
      program: true,
      batch: true,
      instructor: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
      competencies: { include: { competency: true }, orderBy: { competency: { displayOrder: "asc" } } },
      assessments: {
        include: { competency: { select: { title: true, code: true } }, assessor: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: "desc" },
      },
      attendance: { orderBy: { date: "desc" }, take: 60 },
      activitySubmissions: { include: { activity: { select: { title: true, dueDate: true } } } },
      documents: { include: { uploadedBy: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!trainee) throw new NotFoundError("Trainee not found.");
  return trainee;
}

export async function listPrograms() {
  return prisma.program.findMany({ orderBy: { title: "asc" } });
}

export async function listBatches() {
  return prisma.trainingBatch.findMany({ orderBy: { code: "asc" }, include: { program: { select: { title: true } } } });
}

export async function listInstructors() {
  return prisma.instructor.findMany({
    orderBy: { user: { firstName: "asc" } },
    include: { user: { select: { firstName: true, lastName: true } } },
  });
}

export async function createTrainee(input: CreateTraineeInput, actor: ActorContext) {
  const existingEmail = await prisma.user.findUnique({ where: { email: input.email } });
  if (existingEmail) throw new AppError("A user with this email already exists.", "EMAIL_TAKEN", 409);

  const existingStudentNo = await prisma.trainee.findUnique({ where: { studentNumber: input.studentNumber } });
  if (existingStudentNo) throw new AppError("This student number is already in use.", "STUDENT_NUMBER_TAKEN", 409);

  const traineeRole = await prisma.role.findUnique({ where: { name: "TRAINEE" } });
  if (!traineeRole) throw new AppError("TRAINEE role is not configured.", "ROLE_MISSING", 500);

  const passwordHash = await hashPassword(input.password);

  const trainee = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        passwordHash,
        roles: { create: { roleId: traineeRole.id } },
      },
    });

    const created = await tx.trainee.create({
      data: {
        userId: user.id,
        studentNumber: input.studentNumber,
        programId: input.programId || null,
        batchId: input.batchId || null,
        instructorId: input.instructorId || null,
      },
    });

    // Every trainee tracks all active competencies from day one.
    const competencies = await tx.competency.findMany({ where: { status: "ACTIVE" }, select: { id: true } });
    if (competencies.length > 0) {
      await tx.traineeCompetency.createMany({
        data: competencies.map((c) => ({ traineeId: created.id, competencyId: c.id })),
      });
    }

    return { trainee: created, user };
  });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "CREATE",
    module: "trainees",
    recordId: trainee.trainee.id,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    newValue: { studentNumber: trainee.trainee.studentNumber, email: trainee.user.email },
  });

  return trainee.trainee;
}

export async function updateTrainee(id: string, input: UpdateTraineeInput, actor: ActorContext) {
  const existing = await prisma.trainee.findUnique({ where: { id, deletedAt: null } });
  if (!existing) throw new NotFoundError("Trainee not found.");

  if (input.studentNumber && input.studentNumber !== existing.studentNumber) {
    const dupe = await prisma.trainee.findUnique({ where: { studentNumber: input.studentNumber } });
    if (dupe) throw new AppError("This student number is already in use.", "STUDENT_NUMBER_TAKEN", 409);
  }

  const trainee = await prisma.$transaction(async (tx) => {
    if (input.firstName || input.lastName) {
      await tx.user.update({
        where: { id: existing.userId },
        data: { firstName: input.firstName ?? undefined, lastName: input.lastName ?? undefined },
      });
    }
    return tx.trainee.update({
      where: { id },
      data: {
        studentNumber: input.studentNumber ?? undefined,
        programId: input.programId !== undefined ? input.programId || null : undefined,
        batchId: input.batchId !== undefined ? input.batchId || null : undefined,
        instructorId: input.instructorId !== undefined ? input.instructorId || null : undefined,
        status: input.status ?? undefined,
      },
    });
  });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "UPDATE",
    module: "trainees",
    recordId: id,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    previousValue: { status: existing.status },
    newValue: input,
  });

  return trainee;
}

export async function archiveTrainee(id: string, actor: ActorContext) {
  const existing = await prisma.trainee.findUnique({ where: { id, deletedAt: null } });
  if (!existing) throw new NotFoundError("Trainee not found.");

  const trainee = await prisma.trainee.update({
    where: { id },
    data: { deletedAt: new Date(), status: "WITHDRAWN" },
  });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "DELETE",
    module: "trainees",
    recordId: id,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    previousValue: { status: existing.status },
    newValue: { archived: true },
  });

  return trainee;
}

export async function recordAttendance(
  traineeId: string,
  date: string,
  status: AttendanceStatus,
  remarks: string | undefined,
  actor: ActorContext
) {
  const trainee = await prisma.trainee.findUnique({ where: { id: traineeId, deletedAt: null } });
  if (!trainee) throw new NotFoundError("Trainee not found.");

  const day = new Date(date);
  day.setHours(0, 0, 0, 0);

  const attendance = await prisma.attendance.upsert({
    where: { traineeId_date: { traineeId, date: day } },
    update: { status, remarks: remarks || null },
    create: { traineeId, date: day, status, remarks: remarks || null },
  });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "ATTENDANCE_RECORDED",
    module: "trainees",
    recordId: traineeId,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    newValue: { date: day.toISOString().slice(0, 10), status },
  });

  return attendance;
}

export async function uploadTraineeDocument(
  traineeId: string,
  file: File,
  label: string,
  actor: ActorContext
) {
  const trainee = await prisma.trainee.findUnique({ where: { id: traineeId, deletedAt: null } });
  if (!trainee) throw new NotFoundError("Trainee not found.");

  const stored = await saveUploadedFile(file, "trainee-documents");

  const document = await prisma.traineeDocument.create({
    data: {
      traineeId,
      label,
      fileName: stored.fileName,
      storedName: stored.storedName,
      mimeType: stored.mimeType,
      sizeBytes: stored.sizeBytes,
      uploadedById: actor.userId,
    },
  });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "EVIDENCE_UPLOADED",
    module: "trainees",
    recordId: traineeId,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    newValue: { label, fileName: stored.fileName },
  });

  return document;
}

export async function getTraineeDocument(traineeId: string, documentId: string) {
  const document = await prisma.traineeDocument.findFirst({ where: { id: documentId, traineeId } });
  if (!document) throw new NotFoundError("Document not found.");
  return document;
}

export async function exportTraineesCsv(filters: TraineeListFilters = {}) {
  const where: Prisma.TraineeWhereInput = {
    deletedAt: null,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.batchId ? { batchId: filters.batchId } : {}),
    ...(filters.instructorId ? { instructorId: filters.instructorId } : {}),
  };

  const rows = await prisma.trainee.findMany({
    where,
    include: listInclude,
    orderBy: { studentNumber: "asc" },
  });

  const header = ["Student Number", "First Name", "Last Name", "Email", "Batch", "Instructor", "Status", "Avg Progress %"];
  const dataRows = rows.map((t) => {
    const avgProgress = t.competencies.length
      ? Math.round(t.competencies.reduce((sum, c) => sum + c.progress, 0) / t.competencies.length)
      : 0;
    return [
      t.studentNumber,
      t.user.firstName,
      t.user.lastName,
      t.user.email,
      t.batch?.code ?? "",
      t.instructor ? `${t.instructor.user.firstName} ${t.instructor.user.lastName}` : "",
      t.status,
      avgProgress,
    ];
  });
  return toCsv(header, dataRows);
}

type ImportRow = { firstName: string; lastName: string; email: string; studentNumber: string };

export async function importTrainees(rows: ImportRow[], actor: ActorContext) {
  const results = { created: 0, skipped: 0, errors: [] as string[] };

  for (const row of rows) {
    try {
      await createTrainee(
        {
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email,
          studentNumber: row.studentNumber,
          // Imported trainees get a random temporary password; an admin resets it via Users if needed.
          password: `Temp${Math.random().toString(36).slice(2, 10)}A1!`,
        },
        actor
      );
      results.created += 1;
    } catch (err) {
      results.skipped += 1;
      results.errors.push(`${row.email || row.studentNumber}: ${err instanceof AppError ? err.message : "Failed to import."}`);
    }
  }

  return results;
}
