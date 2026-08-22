import "server-only";
import type { AssessmentResult, AssessmentStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { AppError, NotFoundError } from "@/lib/errors";
import { nextNumber } from "@/lib/number-sequence";
import { saveUploadedFile } from "@/lib/file-upload";
import type {
  AddEvidenceInput,
  CreateAssessmentInput,
  FinalizeAssessmentInput,
  SubmitAssessmentInput,
} from "@/validators/assessment.schema";
import type { PaginationInput } from "@/validators/pagination.schema";
import { paginationMeta } from "@/validators/pagination.schema";

type ActorContext = { userId: string; role: string | null; ipAddress?: string | null; userAgent?: string | null };

const OPEN_STATUSES: AssessmentStatus[] = ["SCHEDULED", "IN_PROGRESS", "SUBMITTED", "UNDER_REVIEW"];

export async function getAssessmentKpis() {
  const [total, pending, inProgress, completed, competent] = await Promise.all([
    prisma.assessment.count(),
    prisma.assessment.count({ where: { status: "SCHEDULED" } }),
    prisma.assessment.count({ where: { status: { in: ["IN_PROGRESS", "SUBMITTED", "UNDER_REVIEW"] } } }),
    prisma.assessment.count({ where: { status: "COMPLETED" } }),
    prisma.assessment.count({ where: { status: "COMPLETED", result: "COMPETENT" } }),
  ]);

  const completedForRate = await prisma.assessment.count({ where: { status: "COMPLETED" } });
  const competentRate = completedForRate > 0 ? Math.round((competent / completedForRate) * 100) : 0;

  return { total, pending, inProgress, completed, competentRate };
}

const listInclude = {
  trainee: { include: { user: { select: { firstName: true, lastName: true } } } },
  competency: { select: { id: true, code: true, title: true } },
  assessor: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.AssessmentInclude;

export type AssessmentListFilters = {
  competencyId?: string;
  assessorId?: string;
  status?: AssessmentStatus;
  result?: AssessmentResult;
  dateFrom?: string;
  dateTo?: string;
};

export async function listAssessments(pagination: PaginationInput, filters: AssessmentListFilters = {}) {
  const { page, pageSize, search, sortBy, sortDir } = pagination;

  const where: Prisma.AssessmentWhereInput = {
    ...(filters.competencyId ? { competencyId: filters.competencyId } : {}),
    ...(filters.assessorId ? { assessorId: filters.assessorId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.result ? { result: filters.result } : {}),
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
            { assessmentNo: { contains: search, mode: "insensitive" } },
            { trainee: { user: { firstName: { contains: search, mode: "insensitive" } } } },
            { trainee: { user: { lastName: { contains: search, mode: "insensitive" } } } },
            { competency: { title: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const sortableFields = new Set(["createdAt", "assessmentNo", "status", "result"]);
  const orderBy: Prisma.AssessmentOrderByWithRelationInput =
    sortBy && sortableFields.has(sortBy) ? { [sortBy]: sortDir } : { createdAt: "desc" };

  const [rows, total] = await Promise.all([
    prisma.assessment.findMany({ where, include: listInclude, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.assessment.count({ where }),
  ]);

  return { rows, meta: paginationMeta(total, { page, pageSize }) };
}

export async function getAssessmentById(id: string) {
  const assessment = await prisma.assessment.findUnique({
    where: { id },
    include: {
      trainee: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
      competency: true,
      assessor: { select: { firstName: true, lastName: true, email: true } },
      reviewedBy: { select: { firstName: true, lastName: true } },
      finalizedBy: { select: { firstName: true, lastName: true } },
      createdBy: { select: { firstName: true, lastName: true } },
      evidence: { include: { uploadedBy: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" } },
      correctionOf: { select: { id: true, assessmentNo: true, result: true, finalizedAt: true } },
      correction: { select: { id: true, assessmentNo: true, result: true, finalizedAt: true } },
    },
  });
  if (!assessment) throw new NotFoundError("Assessment not found.");
  return assessment;
}

export async function listAssessableTrainees() {
  return prisma.trainee.findMany({
    where: { deletedAt: null, status: { in: ["ACTIVE", "ON_HOLD"] } },
    include: { user: { select: { firstName: true, lastName: true } } },
    orderBy: { user: { firstName: "asc" } },
  });
}

export async function listAssessors() {
  const users = await prisma.user.findMany({
    where: { isActive: true, deletedAt: null, roles: { some: { role: { name: { in: ["ASSESSOR", "INSTRUCTOR", "ADMINISTRATOR", "SUPER_ADMIN"] } } } } },
    select: { id: true, firstName: true, lastName: true },
    orderBy: { firstName: "asc" },
  });
  return users;
}

export async function createAssessment(input: CreateAssessmentInput, actor: ActorContext) {
  const [trainee, competency, assessor] = await Promise.all([
    prisma.trainee.findUnique({ where: { id: input.traineeId, deletedAt: null } }),
    prisma.competency.findUnique({ where: { id: input.competencyId } }),
    prisma.user.findUnique({ where: { id: input.assessorId } }),
  ]);
  if (!trainee) throw new NotFoundError("Trainee not found.");
  if (!competency) throw new NotFoundError("Competency not found.");
  if (!assessor) throw new NotFoundError("Assessor not found.");

  const assessment = await prisma.$transaction(async (tx) => {
    const assessmentNo = await nextNumber(tx, "assessment", "AS");
    const created = await tx.assessment.create({
      data: {
        assessmentNo,
        traineeId: input.traineeId,
        competencyId: input.competencyId,
        assessorId: input.assessorId,
        scheduledDate: input.scheduledDate ? new Date(input.scheduledDate) : null,
        createdById: actor.userId,
      },
      include: listInclude,
    });

    await tx.traineeCompetency.upsert({
      where: { traineeId_competencyId: { traineeId: input.traineeId, competencyId: input.competencyId } },
      update: { status: "FOR_ASSESSMENT" },
      create: { traineeId: input.traineeId, competencyId: input.competencyId, status: "FOR_ASSESSMENT" },
    });

    return created;
  });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "CREATE",
    module: "assessments",
    recordId: assessment.id,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    newValue: { assessmentNo: assessment.assessmentNo, trainee: `${assessment.trainee.user.firstName} ${assessment.trainee.user.lastName}` },
  });

  return assessment;
}

export async function addEvidence(assessmentId: string, input: AddEvidenceInput, file: File | null, actor: ActorContext) {
  const assessment = await prisma.assessment.findUnique({ where: { id: assessmentId } });
  if (!assessment) throw new NotFoundError("Assessment not found.");
  if (assessment.status === "COMPLETED" || assessment.status === "CANCELLED") {
    throw new AppError(`Cannot add evidence to an assessment that is already ${assessment.status.toLowerCase()}.`, "ASSESSMENT_LOCKED", 409);
  }

  const stored = file ? await saveUploadedFile(file, "assessment-evidence") : null;

  const evidence = await prisma.assessmentEvidence.create({
    data: {
      assessmentId,
      type: input.type,
      description: input.description || null,
      fileName: stored?.fileName,
      storedName: stored?.storedName,
      mimeType: stored?.mimeType,
      sizeBytes: stored?.sizeBytes,
      uploadedById: actor.userId,
    },
  });

  if (assessment.status === "SCHEDULED") {
    await prisma.assessment.update({ where: { id: assessmentId }, data: { status: "IN_PROGRESS" } });
  }

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "EVIDENCE_UPLOADED",
    module: "assessments",
    recordId: assessmentId,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    newValue: { type: input.type, fileName: stored?.fileName },
  });

  return evidence;
}

export async function getEvidenceById(assessmentId: string, evidenceId: string) {
  const evidence = await prisma.assessmentEvidence.findFirst({ where: { id: evidenceId, assessmentId } });
  if (!evidence) throw new NotFoundError("Evidence not found.");
  return evidence;
}

export async function submitAssessment(id: string, input: SubmitAssessmentInput, actor: ActorContext) {
  const existing = await prisma.assessment.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Assessment not found.");
  if (!["SCHEDULED", "IN_PROGRESS"].includes(existing.status)) {
    throw new AppError(`Cannot submit an assessment that is ${existing.status.toLowerCase().replace("_", " ")}.`, "INVALID_STATE", 409);
  }

  const assessment = await prisma.assessment.update({
    where: { id },
    data: {
      status: "SUBMITTED",
      observations: input.observations || existing.observations,
      remarks: input.remarks || existing.remarks,
      score: input.score ?? existing.score,
      submittedAt: new Date(),
    },
    include: listInclude,
  });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "ASSESSMENT_SUBMITTED",
    module: "assessments",
    recordId: id,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    newValue: { assessmentNo: assessment.assessmentNo },
  });

  return assessment;
}

export async function reviewAssessment(id: string, actor: ActorContext) {
  const existing = await prisma.assessment.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Assessment not found.");
  if (existing.status !== "SUBMITTED") {
    throw new AppError("Only a submitted assessment can move to review.", "INVALID_STATE", 409);
  }

  const assessment = await prisma.assessment.update({
    where: { id },
    data: { status: "UNDER_REVIEW", reviewedAt: new Date(), reviewedById: actor.userId },
    include: listInclude,
  });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "ASSESSMENT_REVIEWED",
    module: "assessments",
    recordId: id,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    newValue: { assessmentNo: assessment.assessmentNo },
  });

  return assessment;
}

async function applyResultToTraineeCompetency(
  tx: Prisma.TransactionClient,
  traineeId: string,
  competencyId: string,
  result: AssessmentResult
) {
  if (result === "COMPETENT") {
    await tx.traineeCompetency.upsert({
      where: { traineeId_competencyId: { traineeId, competencyId } },
      update: { status: "COMPETENT", progress: 100 },
      create: { traineeId, competencyId, status: "COMPETENT", progress: 100 },
    });
  } else if (result === "NOT_YET_COMPETENT") {
    await tx.traineeCompetency.upsert({
      where: { traineeId_competencyId: { traineeId, competencyId } },
      update: { status: "NOT_YET_COMPETENT" },
      create: { traineeId, competencyId, status: "NOT_YET_COMPETENT" },
    });
  }
}

export async function finalizeAssessment(id: string, input: FinalizeAssessmentInput, actor: ActorContext) {
  const existing = await prisma.assessment.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Assessment not found.");
  if (!["SUBMITTED", "UNDER_REVIEW"].includes(existing.status)) {
    throw new AppError(
      `Cannot finalize an assessment that is ${existing.status.toLowerCase().replace("_", " ")}.`,
      "INVALID_STATE",
      409
    );
  }

  const assessment = await prisma.$transaction(async (tx) => {
    const updated = await tx.assessment.update({
      where: { id },
      data: {
        status: "COMPLETED",
        result: input.result,
        remarks: input.remarks || existing.remarks,
        finalizedAt: new Date(),
        finalizedById: actor.userId,
      },
      include: listInclude,
    });

    await applyResultToTraineeCompetency(tx, existing.traineeId, existing.competencyId, input.result);

    return updated;
  });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "ASSESSMENT_FINALIZED",
    module: "assessments",
    recordId: id,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    newValue: { assessmentNo: assessment.assessmentNo, result: input.result },
  });

  return assessment;
}

/**
 * Assessments are immutable once finalized — a correction never edits the
 * original row. Instead it creates a new, already-finalized Assessment
 * linked back via `correctionOfId`, so the original result stays in the
 * audit trail exactly as it was decided.
 */
export async function correctAssessment(id: string, input: FinalizeAssessmentInput, actor: ActorContext) {
  const original = await prisma.assessment.findUnique({ where: { id }, include: { correction: true } });
  if (!original) throw new NotFoundError("Assessment not found.");
  if (original.status !== "COMPLETED") {
    throw new AppError("Only a completed assessment can be corrected.", "INVALID_STATE", 409);
  }
  if (original.correction) {
    throw new AppError("This assessment has already been corrected.", "ALREADY_CORRECTED", 409);
  }

  const correction = await prisma.$transaction(async (tx) => {
    const assessmentNo = await nextNumber(tx, "assessment", "AS");
    const created = await tx.assessment.create({
      data: {
        assessmentNo,
        traineeId: original.traineeId,
        competencyId: original.competencyId,
        assessorId: original.assessorId,
        status: "COMPLETED",
        result: input.result,
        remarks: input.remarks || null,
        submittedAt: new Date(),
        reviewedAt: new Date(),
        reviewedById: actor.userId,
        finalizedAt: new Date(),
        finalizedById: actor.userId,
        correctionOfId: original.id,
        createdById: actor.userId,
      },
      include: listInclude,
    });

    await applyResultToTraineeCompetency(tx, original.traineeId, original.competencyId, input.result);

    return created;
  });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "ASSESSMENT_CORRECTED",
    module: "assessments",
    recordId: correction.id,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    previousValue: { assessmentNo: original.assessmentNo, result: original.result },
    newValue: { assessmentNo: correction.assessmentNo, result: input.result },
  });

  return correction;
}

export async function cancelAssessment(id: string, actor: ActorContext) {
  const existing = await prisma.assessment.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Assessment not found.");
  if (!OPEN_STATUSES.includes(existing.status)) {
    throw new AppError(`Cannot cancel an assessment that is already ${existing.status.toLowerCase()}.`, "INVALID_STATE", 409);
  }

  const assessment = await prisma.assessment.update({ where: { id }, data: { status: "CANCELLED" }, include: listInclude });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "CANCEL",
    module: "assessments",
    recordId: id,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
  });

  return assessment;
}
