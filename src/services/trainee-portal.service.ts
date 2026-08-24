import "server-only";
import type { Prisma, SubmissionStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { AppError, NotFoundError } from "@/lib/errors";
import { saveUploadedFile } from "@/lib/file-upload";
import { createNotification } from "@/services/notification.service";
import type { PaginationInput } from "@/validators/pagination.schema";
import { paginationMeta } from "@/validators/pagination.schema";

type ActorContext = { userId: string; role: string | null; ipAddress?: string | null; userAgent?: string | null };

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

/** Everything the trainee dashboard needs, in one pass, all scoped to the caller's own trainee row. */
export async function getMyDashboard(traineeId: string) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const [trainee, competencies, pendingActivities, upcomingAssessments, todaysSubmissions, attendanceRows] =
    await Promise.all([
      prisma.trainee.findUniqueOrThrow({
        where: { id: traineeId },
        include: {
          user: { select: { firstName: true, lastName: true } },
          batch: { select: { code: true } },
          instructor: { select: { user: { select: { firstName: true, lastName: true } } } },
        },
      }),
      prisma.traineeCompetency.findMany({
        where: { traineeId },
        include: { competency: { select: { id: true, code: true, title: true, displayOrder: true } } },
        orderBy: { competency: { displayOrder: "asc" } },
      }),
      prisma.trainingActivitySubmission.findMany({
        where: { traineeId, status: { in: ["ASSIGNED", "IN_PROGRESS"] } },
        include: { activity: { select: { id: true, title: true, dueDate: true, competency: { select: { title: true } } } } },
        orderBy: { activity: { dueDate: "asc" } },
        take: 10,
      }),
      prisma.assessment.findMany({
        where: { traineeId, status: "SCHEDULED" },
        include: { competency: { select: { title: true } }, assessor: { select: { firstName: true, lastName: true } } },
        orderBy: { scheduledDate: "asc" },
        take: 10,
      }),
      prisma.trainingActivitySubmission.findMany({
        where: {
          traineeId,
          status: { in: ["ASSIGNED", "IN_PROGRESS"] },
          activity: { dueDate: { gte: todayStart, lte: todayEnd } },
        },
        include: { activity: { select: { id: true, title: true, dueDate: true, competency: { select: { title: true } } } } },
      }),
      prisma.attendance.findMany({ where: { traineeId }, orderBy: { date: "desc" }, take: 60 }),
    ]);

  const overallProgress = competencies.length
    ? Math.round(competencies.reduce((sum, c) => sum + c.progress, 0) / competencies.length)
    : 0;
  const competenciesCompleted = competencies.filter((c) => c.status === "COMPETENT" || c.status === "COMPLETED").length;

  const marked = attendanceRows.length;
  const present = attendanceRows.filter((a) => a.status === "PRESENT").length;
  const late = attendanceRows.filter((a) => a.status === "LATE").length;
  const absent = attendanceRows.filter((a) => a.status === "ABSENT").length;
  const excused = attendanceRows.filter((a) => a.status === "EXCUSED").length;
  const attendanceRate = marked > 0 ? Math.round(((present + late) / marked) * 100) : 0;

  const [recentGraded, recentAssessed] = await Promise.all([
    prisma.trainingActivitySubmission.findMany({
      where: { traineeId, remarks: { not: null } },
      include: { activity: { select: { title: true } } },
      orderBy: { gradedAt: "desc" },
      take: 3,
    }),
    prisma.assessment.findMany({
      where: { traineeId, remarks: { not: null }, status: "COMPLETED" },
      include: { competency: { select: { title: true } } },
      orderBy: { finalizedAt: "desc" },
      take: 3,
    }),
  ]);

  const recentFeedback = [
    ...recentGraded.map((s) => ({
      id: `sub-${s.id}`,
      source: s.activity.title,
      remarks: s.remarks!,
      date: s.gradedAt ?? s.submittedAt ?? new Date(0),
    })),
    ...recentAssessed.map((a) => ({
      id: `as-${a.id}`,
      source: a.competency.title,
      remarks: a.remarks!,
      date: a.finalizedAt ?? new Date(0),
    })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 5);

  return {
    trainee: {
      studentNumber: trainee.studentNumber,
      name: `${trainee.user.firstName} ${trainee.user.lastName}`,
      status: trainee.status,
      batch: trainee.batch?.code ?? null,
      instructor: trainee.instructor ? `${trainee.instructor.user.firstName} ${trainee.instructor.user.lastName}` : null,
    },
    kpis: {
      trainingProgress: overallProgress,
      competenciesCompleted,
      competenciesTotal: competencies.length,
      pendingActivities: pendingActivities.length,
      upcomingAssessments: upcomingAssessments.length,
    },
    competencies: competencies.map((c) => ({
      id: c.competency.id,
      code: c.competency.code,
      title: c.competency.title,
      progress: c.progress,
      status: c.status,
    })),
    todaysActivities: todaysSubmissions.map((s) => ({
      submissionId: s.id,
      title: s.activity.title,
      competency: s.activity.competency?.title ?? null,
      dueDate: s.activity.dueDate,
      status: s.status,
    })),
    pendingActivities: pendingActivities.map((s) => ({
      submissionId: s.id,
      title: s.activity.title,
      competency: s.activity.competency?.title ?? null,
      dueDate: s.activity.dueDate,
      status: s.status,
    })),
    upcomingAssessments: upcomingAssessments.map((a) => ({
      id: a.id,
      assessmentNo: a.assessmentNo,
      competency: a.competency.title,
      scheduledDate: a.scheduledDate,
      assessor: `${a.assessor.firstName} ${a.assessor.lastName}`,
      status: a.status,
    })),
    recentFeedback,
    attendance: { rate: attendanceRate, present, late, absent, excused, marked },
  };
}

export type MyActivityFilters = { status?: SubmissionStatus; competencyId?: string };

export async function getMyActivities(traineeId: string, pagination: PaginationInput, filters: MyActivityFilters = {}) {
  const { page, pageSize, search, sortDir } = pagination;

  const where: Prisma.TrainingActivitySubmissionWhereInput = {
    traineeId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.competencyId ? { activity: { competencyId: filters.competencyId } } : {}),
    ...(search ? { activity: { title: { contains: search, mode: "insensitive" } } } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.trainingActivitySubmission.findMany({
      where,
      include: {
        activity: {
          select: { id: true, title: true, description: true, instructions: true, dueDate: true, assignedDate: true, competency: { select: { id: true, title: true } } },
        },
      },
      orderBy: { activity: { dueDate: sortDir } },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.trainingActivitySubmission.count({ where }),
  ]);

  const now = new Date();
  const withOverdue = rows.map((r) => ({
    ...r,
    overdue: !!r.activity.dueDate && r.activity.dueDate < now && !["SUBMITTED", "REVIEWED", "COMPLETED"].includes(r.status),
  }));

  return { rows: withOverdue, meta: paginationMeta(total, { page, pageSize }) };
}

export async function getMyActivityById(traineeId: string, submissionId: string) {
  const submission = await prisma.trainingActivitySubmission.findFirst({
    where: { id: submissionId, traineeId },
    include: {
      activity: { include: { competency: { select: { id: true, title: true } }, instructor: { select: { user: { select: { firstName: true, lastName: true } } } } } },
      gradedBy: { select: { firstName: true, lastName: true } },
    },
  });
  if (!submission) throw new NotFoundError("Activity not found.");
  return submission;
}

export async function startMyActivity(traineeId: string, submissionId: string, actor: ActorContext) {
  const submission = await prisma.trainingActivitySubmission.findFirst({ where: { id: submissionId, traineeId } });
  if (!submission) throw new NotFoundError("Activity not found.");
  if (submission.status !== "ASSIGNED") {
    throw new AppError(`Cannot start an activity that is ${submission.status.toLowerCase()}.`, "INVALID_STATE", 409);
  }

  return prisma.trainingActivitySubmission.update({ where: { id: submissionId }, data: { status: "IN_PROGRESS" } });
}

export async function submitMyActivity(
  traineeId: string,
  submissionId: string,
  remarks: string | undefined,
  file: File | null,
  actor: ActorContext
) {
  const submission = await prisma.trainingActivitySubmission.findFirst({
    where: { id: submissionId, traineeId },
    include: { activity: { select: { title: true, instructor: { select: { userId: true } } } } },
  });
  if (!submission) throw new NotFoundError("Activity not found.");
  if (!["ASSIGNED", "IN_PROGRESS"].includes(submission.status)) {
    throw new AppError(`Cannot submit an activity that is ${submission.status.toLowerCase()}.`, "INVALID_STATE", 409);
  }

  const stored = file ? await saveUploadedFile(file, "training-activity-submissions") : null;

  const updated = await prisma.trainingActivitySubmission.update({
    where: { id: submissionId },
    data: {
      status: "SUBMITTED",
      submittedAt: new Date(),
      remarks: remarks || submission.remarks,
      fileName: stored?.fileName ?? undefined,
      storedName: stored?.storedName ?? undefined,
      mimeType: stored?.mimeType ?? undefined,
      sizeBytes: stored?.sizeBytes ?? undefined,
    },
  });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "TRAINING_ACTIVITY_SUBMITTED",
    module: "training-activities",
    recordId: submissionId,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    newValue: { activity: submission.activity.title },
  });

  await createNotification(
    submission.activity.instructor.userId,
    "Activity submitted",
    `A trainee submitted "${submission.activity.title}" for review.`,
    "TRAINING_ACTIVITY_SUBMITTED",
    submissionId
  );

  return updated;
}

export async function getMyCompetencies(traineeId: string) {
  const rows = await prisma.traineeCompetency.findMany({
    where: { traineeId },
    include: {
      competency: true,
    },
    orderBy: { competency: { displayOrder: "asc" } },
  });

  const competencyIds = rows.map((r) => r.competencyId);
  const [activityCounts, assessments] = await Promise.all([
    prisma.trainingActivitySubmission.findMany({
      where: { traineeId, activity: { competencyId: { in: competencyIds } } },
      select: { status: true, activity: { select: { competencyId: true } } },
    }),
    prisma.assessment.findMany({
      where: { traineeId, competencyId: { in: competencyIds } },
      orderBy: { createdAt: "desc" },
      select: { competencyId: true, status: true, result: true, scheduledDate: true, remarks: true },
    }),
  ]);

  return rows.map((r) => {
    const activities = activityCounts.filter((a) => a.activity.competencyId === r.competencyId);
    const completedActivities = activities.filter((a) => a.status === "COMPLETED").length;
    const latestAssessment = assessments.find((a) => a.competencyId === r.competencyId) ?? null;

    return {
      id: r.competency.id,
      code: r.competency.code,
      title: r.competency.title,
      description: r.competency.description,
      progress: r.progress,
      status: r.status,
      activities: { completed: completedActivities, total: activities.length },
      assessment: latestAssessment,
    };
  });
}

export async function getMyAssessments(traineeId: string) {
  return prisma.assessment.findMany({
    where: { traineeId },
    include: {
      competency: { select: { id: true, title: true, code: true } },
      assessor: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getMyAssessmentById(traineeId: string, assessmentId: string) {
  const assessment = await prisma.assessment.findFirst({
    where: { id: assessmentId, traineeId },
    include: {
      competency: true,
      assessor: { select: { firstName: true, lastName: true } },
      evidence: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!assessment) throw new NotFoundError("Assessment not found.");
  return assessment;
}

export async function getMyAttendance(traineeId: string) {
  const rows = await prisma.attendance.findMany({ where: { traineeId }, orderBy: { date: "desc" }, take: 180 });

  const marked = rows.length;
  const present = rows.filter((a) => a.status === "PRESENT").length;
  const late = rows.filter((a) => a.status === "LATE").length;
  const absent = rows.filter((a) => a.status === "ABSENT").length;
  const excused = rows.filter((a) => a.status === "EXCUSED").length;
  const rate = marked > 0 ? Math.round(((present + late) / marked) * 100) : 0;

  return { rows, summary: { rate, present, late, absent, excused, marked } };
}

export async function getMyProgress(traineeId: string) {
  const [competencies, activitySubmissions, assessments, attendance] = await Promise.all([
    prisma.traineeCompetency.findMany({ where: { traineeId }, include: { competency: { select: { title: true, displayOrder: true } } }, orderBy: { competency: { displayOrder: "asc" } } }),
    prisma.trainingActivitySubmission.findMany({ where: { traineeId }, select: { status: true } }),
    prisma.assessment.findMany({ where: { traineeId }, select: { status: true, result: true } }),
    prisma.attendance.findMany({ where: { traineeId }, select: { status: true } }),
  ]);

  const overallProgress = competencies.length
    ? Math.round(competencies.reduce((sum, c) => sum + c.progress, 0) / competencies.length)
    : 0;

  const activitiesCompleted = activitySubmissions.filter((s) => s.status === "COMPLETED").length;
  const assessmentsCompleted = assessments.filter((a) => a.status === "COMPLETED").length;
  const attendanceMarked = attendance.length;
  const attendancePresent = attendance.filter((a) => a.status === "PRESENT" || a.status === "LATE").length;

  return {
    overallProgress,
    competencies: competencies.map((c) => ({ title: c.competency.title, progress: c.progress, status: c.status })),
    activities: { completed: activitiesCompleted, total: activitySubmissions.length },
    assessments: { completed: assessmentsCompleted, total: assessments.length, competent: assessments.filter((a) => a.result === "COMPETENT").length },
    attendance: { rate: attendanceMarked > 0 ? Math.round((attendancePresent / attendanceMarked) * 100) : 0, marked: attendanceMarked },
  };
}

const EVIDENCE_SUBDIRS = {
  document: "trainee-documents",
  "assessment-evidence": "assessment-evidence",
  "activity-submission": "training-activity-submissions",
} as const;

export async function getMyEvidenceFile(traineeId: string, kind: keyof typeof EVIDENCE_SUBDIRS, id: string) {
  let file: { storedName: string | null; fileName: string | null; mimeType: string | null } | null = null;

  if (kind === "document") {
    file = await prisma.traineeDocument.findFirst({ where: { id, traineeId }, select: { storedName: true, fileName: true, mimeType: true } });
  } else if (kind === "assessment-evidence") {
    file = await prisma.assessmentEvidence.findFirst({
      where: { id, assessment: { traineeId } },
      select: { storedName: true, fileName: true, mimeType: true },
    });
  } else if (kind === "activity-submission") {
    file = await prisma.trainingActivitySubmission.findFirst({ where: { id, traineeId }, select: { storedName: true, fileName: true, mimeType: true } });
  }

  if (!file || !file.storedName || !file.fileName || !file.mimeType) throw new NotFoundError("File not found.");
  return { subdir: EVIDENCE_SUBDIRS[kind], storedName: file.storedName, fileName: file.fileName, mimeType: file.mimeType };
}

export async function getMyEvidence(traineeId: string) {
  const [documents, assessmentEvidence, submissionFiles] = await Promise.all([
    prisma.traineeDocument.findMany({
      where: { traineeId },
      include: { uploadedBy: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.assessmentEvidence.findMany({
      where: { assessment: { traineeId }, storedName: { not: null } },
      include: {
        assessment: { select: { assessmentNo: true, competency: { select: { title: true } } } },
        uploadedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.trainingActivitySubmission.findMany({
      where: { traineeId, storedName: { not: null } },
      include: { activity: { select: { title: true } } },
      orderBy: { submittedAt: "desc" },
    }),
  ]);

  return {
    documents: documents.map((d) => ({
      id: d.id,
      kind: "document" as const,
      label: d.label,
      category: d.category,
      description: d.description,
      fileName: d.fileName,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      uploadedBy: `${d.uploadedBy.firstName} ${d.uploadedBy.lastName}`,
      createdAt: d.createdAt,
    })),
    assessmentEvidence: assessmentEvidence.map((e) => ({
      id: e.id,
      kind: "assessment-evidence" as const,
      label: `${e.assessment.competency.title} — ${e.type.replaceAll("_", " ")}`,
      category: "Assessment Evidence" as const,
      description: e.description ?? null,
      fileName: e.fileName,
      mimeType: e.mimeType ?? null,
      sizeBytes: e.sizeBytes ?? null,
      uploadedBy: `${e.uploadedBy.firstName} ${e.uploadedBy.lastName}`,
      assessmentNo: e.assessment.assessmentNo,
      createdAt: e.createdAt,
    })),
    submissionFiles: submissionFiles.map((s) => ({
      id: s.id,
      kind: "activity-submission" as const,
      label: s.activity.title,
      category: "Activity Evidence" as const,
      description: s.remarks ?? null,
      fileName: s.fileName,
      mimeType: s.mimeType ?? null,
      sizeBytes: s.sizeBytes ?? null,
      uploadedBy: null,
      createdAt: s.submittedAt,
    })),
  };
}

export async function uploadMyDocument(
  traineeId: string,
  file: File,
  label: string,
  category: string,
  description: string | undefined,
  actor: ActorContext
) {
  const stored = await saveUploadedFile(file, "trainee-documents");

  const document = await prisma.traineeDocument.create({
    data: {
      traineeId,
      label,
      category,
      description: description || null,
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
    module: "trainee-portal",
    recordId: document.id,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    newValue: { label, category, fileName: stored.fileName },
  });

  return document;
}

export async function deleteMyDocument(traineeId: string, documentId: string, actor: ActorContext) {
  const doc = await prisma.traineeDocument.findFirst({
    where: { id: documentId, traineeId, uploadedById: actor.userId },
  });
  if (!doc) throw new NotFoundError("Document not found or you do not have permission to delete it.");

  await prisma.traineeDocument.delete({ where: { id: documentId } });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "DELETE",
    module: "trainee-portal",
    recordId: documentId,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    newValue: { label: doc.label, fileName: doc.fileName },
  });
}

