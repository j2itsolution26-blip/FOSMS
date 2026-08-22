import "server-only";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { NotFoundError } from "@/lib/errors";
import type { CompetencyInput } from "@/validators/competency.schema";

type ActorContext = { userId: string; role: string | null };

export async function listCompetencies() {
  return prisma.competency.findMany({
    orderBy: { displayOrder: "asc" },
    include: { _count: { select: { traineeProgress: true, assessments: true } } },
  });
}

export async function getCompetencyKpis() {
  const [total, active, traineesInProgress, competentTrainees] = await Promise.all([
    prisma.competency.count(),
    prisma.competency.count({ where: { status: "ACTIVE" } }),
    prisma.traineeCompetency
      .groupBy({ by: ["traineeId"], where: { status: "IN_PROGRESS" } })
      .then((g) => g.length),
    prisma.traineeCompetency
      .groupBy({ by: ["traineeId"], where: { status: { in: ["COMPETENT", "COMPLETED"] } } })
      .then((g) => g.length),
  ]);

  return { total, active, traineesInProgress, competentTrainees };
}

/** Per-competency breakdown for the card grid: how many trainees are at each stage. */
export async function listCompetenciesWithStats() {
  const competencies = await listCompetencies();

  const stats = await prisma.traineeCompetency.groupBy({
    by: ["competencyId", "status"],
    _count: { _all: true },
    _avg: { progress: true },
  });

  return competencies.map((c) => {
    const rows = stats.filter((s) => s.competencyId === c.id);
    const trainees = rows.reduce((sum, r) => sum + r._count._all, 0);
    const competent = rows.filter((r) => r.status === "COMPETENT" || r.status === "COMPLETED").reduce((sum, r) => sum + r._count._all, 0);
    const inProgress = rows.find((r) => r.status === "IN_PROGRESS")?._count._all ?? 0;
    const forAssessment = rows.find((r) => r.status === "FOR_ASSESSMENT")?._count._all ?? 0;
    const weightedSum = rows.reduce((sum, r) => sum + (r._avg.progress ?? 0) * r._count._all, 0);
    const completion = trainees > 0 ? Math.round(weightedSum / trainees) : 0;

    return { ...c, trainees, competent, inProgress, forAssessment, completion };
  });
}

export async function getCompetencyById(id: string) {
  const competency = await prisma.competency.findUnique({
    where: { id },
    include: {
      traineeProgress: {
        include: { trainee: { include: { user: { select: { firstName: true, lastName: true } } } } },
        orderBy: { progress: "desc" },
      },
      assessments: {
        include: {
          trainee: { include: { user: { select: { firstName: true, lastName: true } } } },
          assessor: { select: { firstName: true, lastName: true } },
          evidence: true,
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      activities: { orderBy: { assignedDate: "desc" }, take: 20 },
    },
  });
  if (!competency) throw new NotFoundError("Competency not found.");
  return competency;
}

function toData(input: CompetencyInput) {
  return {
    code: input.code,
    title: input.title,
    description: input.description || null,
    learningOutcomes: input.learningOutcomes || null,
    performanceCriteria: input.performanceCriteria || null,
    requiredActivities: input.requiredActivities || null,
    assessmentCriteria: input.assessmentCriteria || null,
    status: input.status,
    displayOrder: input.displayOrder,
  };
}

export async function createCompetency(input: CompetencyInput, actor: ActorContext) {
  const competency = await prisma.competency.create({ data: toData(input) });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "CREATE",
    module: "competencies",
    recordId: competency.id,
    newValue: { code: competency.code, title: competency.title },
  });

  return competency;
}

export async function updateCompetency(id: string, input: CompetencyInput, actor: ActorContext) {
  const existing = await prisma.competency.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Competency not found.");

  const competency = await prisma.competency.update({ where: { id }, data: toData(input) });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "UPDATE",
    module: "competencies",
    recordId: id,
    previousValue: { status: existing.status },
    newValue: { status: competency.status },
  });

  return competency;
}
