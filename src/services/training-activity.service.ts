import "server-only";
import type { Prisma, TrainingActivityStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { AppError, NotFoundError } from "@/lib/errors";
import { saveUploadedFile } from "@/lib/file-upload";
import type { PaginationInput } from "@/validators/pagination.schema";
import { paginationMeta } from "@/validators/pagination.schema";
import type { CreateTrainingActivityInput, UpdateTrainingActivityInput } from "@/validators/training-activity.schema";

type ActorContext = { userId: string; role: string | null; ipAddress?: string | null; userAgent?: string | null };

const listInclude = {
  instructor: { include: { user: { select: { firstName: true, lastName: true } } } },
  competency: { select: { id: true, code: true, title: true } },
  submissions: { select: { id: true, status: true } },
} satisfies Prisma.TrainingActivityInclude;

export async function getTrainingActivityKpis() {
  const [total, active, pendingSubmissions, completedSubmissions] = await Promise.all([
    prisma.trainingActivity.count({ where: { status: { not: "ARCHIVED" } } }),
    prisma.trainingActivity.count({ where: { status: "ASSIGNED" } }),
    prisma.trainingActivitySubmission.count({ where: { status: { in: ["ASSIGNED", "IN_PROGRESS", "SUBMITTED"] } } }),
    prisma.trainingActivitySubmission.count({ where: { status: "COMPLETED" } }),
  ]);

  return { total, active, pendingSubmissions, completed: completedSubmissions };
}

export type TrainingActivityFilters = {
  status?: TrainingActivityStatus;
  competencyId?: string;
  instructorId?: string;
};

export async function listTrainingActivities(pagination: PaginationInput, filters: TrainingActivityFilters = {}) {
  const { page, pageSize, search } = pagination;

  const where: Prisma.TrainingActivityWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.competencyId ? { competencyId: filters.competencyId } : {}),
    ...(filters.instructorId ? { instructorId: filters.instructorId } : {}),
    ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.trainingActivity.findMany({
      where,
      include: listInclude,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.trainingActivity.count({ where }),
  ]);

  const now = new Date();
  const withCompletion = rows.map((a) => {
    const assignedCount = a.submissions.length;
    const completedCount = a.submissions.filter((s) => s.status === "COMPLETED").length;
    const overdue = !!a.dueDate && a.dueDate < now && completedCount < assignedCount && a.status !== "ARCHIVED";
    return { ...a, assignedCount, completedCount, overdue };
  });

  return { rows: withCompletion, meta: paginationMeta(total, { page, pageSize }) };
}

export async function getTrainingActivityById(id: string) {
  const activity = await prisma.trainingActivity.findUnique({
    where: { id },
    include: {
      instructor: { include: { user: { select: { firstName: true, lastName: true } } } },
      competency: { select: { id: true, code: true, title: true } },
      submissions: {
        include: { trainee: { include: { user: { select: { firstName: true, lastName: true } } } } },
        orderBy: { trainee: { studentNumber: "asc" } },
      },
    },
  });
  if (!activity) throw new NotFoundError("Training activity not found.");
  return activity;
}

export async function createActivity(input: CreateTrainingActivityInput, file: File | null, actor: ActorContext) {
  const instructor = await prisma.instructor.findUnique({ where: { id: input.instructorId } });
  if (!instructor) throw new AppError("Selected instructor was not found.", "INSTRUCTOR_NOT_FOUND", 404);

  const attachment = file ? await saveUploadedFile(file, "training-activities") : null;

  const activity = await prisma.trainingActivity.create({
    data: {
      instructorId: input.instructorId,
      competencyId: input.competencyId || null,
      title: input.title,
      description: input.description || null,
      instructions: input.instructions || null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      attachmentFileName: attachment?.fileName,
      attachmentStoredName: attachment?.storedName,
      attachmentMimeType: attachment?.mimeType,
      attachmentSizeBytes: attachment?.sizeBytes,
    },
  });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "TRAINING_ACTIVITY_CREATED",
    module: "training-activities",
    recordId: activity.id,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    newValue: { title: activity.title },
  });

  return activity;
}

export async function updateActivity(id: string, input: UpdateTrainingActivityInput, actor: ActorContext) {
  const existing = await prisma.trainingActivity.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Training activity not found.");

  const activity = await prisma.trainingActivity.update({
    where: { id },
    data: {
      instructorId: input.instructorId || undefined,
      competencyId: input.competencyId !== undefined ? input.competencyId || null : undefined,
      title: input.title ?? undefined,
      description: input.description !== undefined ? input.description || null : undefined,
      instructions: input.instructions !== undefined ? input.instructions || null : undefined,
      dueDate: input.dueDate !== undefined ? (input.dueDate ? new Date(input.dueDate) : null) : undefined,
    },
  });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "UPDATE",
    module: "training-activities",
    recordId: id,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
  });

  return activity;
}

export async function archiveActivity(id: string, actor: ActorContext) {
  const existing = await prisma.trainingActivity.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Training activity not found.");

  const activity = await prisma.trainingActivity.update({ where: { id }, data: { status: "ARCHIVED" } });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "DELETE",
    module: "training-activities",
    recordId: id,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    previousValue: { status: existing.status },
  });

  return activity;
}

export async function assignTrainees(activityId: string, traineeIds: string[], actor: ActorContext) {
  const activity = await prisma.trainingActivity.findUnique({ where: { id: activityId } });
  if (!activity) throw new NotFoundError("Training activity not found.");
  if (activity.status === "ARCHIVED") {
    throw new AppError("Cannot assign trainees to an archived activity.", "ACTIVITY_ARCHIVED", 409);
  }

  await prisma.$transaction(async (tx) => {
    for (const traineeId of traineeIds) {
      await tx.trainingActivitySubmission.upsert({
        where: { activityId_traineeId: { activityId, traineeId } },
        update: {},
        create: { activityId, traineeId, status: "ASSIGNED" },
      });
    }
    if (activity.status === "DRAFT") {
      await tx.trainingActivity.update({ where: { id: activityId }, data: { status: "ASSIGNED" } });
    }
  });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "TRAINING_ACTIVITY_ASSIGNED",
    module: "training-activities",
    recordId: activityId,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    newValue: { traineeCount: traineeIds.length },
  });

  return { assigned: traineeIds.length };
}

export async function gradeSubmission(
  submissionId: string,
  score: number,
  remarks: string | undefined,
  actor: ActorContext
) {
  const submission = await prisma.trainingActivitySubmission.findUnique({
    where: { id: submissionId },
    include: { activity: { select: { competencyId: true } } },
  });
  if (!submission) throw new NotFoundError("Submission not found.");

  const updated = await prisma.$transaction(async (tx) => {
    const graded = await tx.trainingActivitySubmission.update({
      where: { id: submissionId },
      data: { score, remarks: remarks || null, status: "COMPLETED", gradedAt: new Date(), gradedById: actor.userId },
    });

    // Grading a related activity is a real signal of engagement with a competency, even
    // though only a finalized Assessment (see assessment.service.ts's applyResultToTraineeCompetency)
    // can certify it COMPETENT. Progress here is capped at 80 — activity completion alone can
    // signal "ready for assessment" but never "done"; only a finalized assessment reaches 100.
    // Never touch a row already COMPETENT/NOT_YET_COMPETENT — that half of the field is owned
    // exclusively by assessment finalization, agreed with the session that owns Assessments.
    if (submission.activity.competencyId) {
      const competencyId = submission.activity.competencyId;
      const traineeId = submission.traineeId;
      const existingProgress = await tx.traineeCompetency.findUnique({
        where: { traineeId_competencyId: { traineeId, competencyId } },
      });

      if (!existingProgress || (existingProgress.status !== "COMPETENT" && existingProgress.status !== "NOT_YET_COMPETENT")) {
        const [totalAssigned, completed] = await Promise.all([
          tx.trainingActivitySubmission.count({ where: { traineeId, activity: { competencyId } } }),
          tx.trainingActivitySubmission.count({ where: { traineeId, activity: { competencyId }, status: "COMPLETED" } }),
        ]);
        const progress = totalAssigned > 0 ? Math.min(80, Math.round((completed / totalAssigned) * 80)) : 0;
        const status = existingProgress?.status === "NOT_STARTED" || !existingProgress ? "IN_PROGRESS" : existingProgress.status;

        await tx.traineeCompetency.upsert({
          where: { traineeId_competencyId: { traineeId, competencyId } },
          update: { status, progress },
          create: { traineeId, competencyId, status, progress },
        });
      }
    }

    return graded;
  });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "TRAINING_ACTIVITY_GRADED",
    module: "training-activities",
    recordId: submissionId,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    newValue: { score, remarks },
  });

  return updated;
}

export async function getRecentTrainingActivityActivity(limit = 8) {
  return prisma.auditLog.findMany({
    where: { module: "training-activities" },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { firstName: true, lastName: true } } },
  });
}
