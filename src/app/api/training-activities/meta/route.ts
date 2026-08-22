import { apiSuccess } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/config/permissions";
import { listInstructors, listTrainees } from "@/services/trainee.service";
import { listCompetencies } from "@/services/competency.service";
import { paginationSchema } from "@/validators/pagination.schema";

export async function GET() {
  const auth = await authorize(PERMISSIONS.TRAINING_ACTIVITIES_VIEW);
  if (auth.error) return auth.error;

  const [instructors, competencies, trainees] = await Promise.all([
    listInstructors(),
    listCompetencies(),
    listTrainees(paginationSchema.parse({ pageSize: 200 })),
  ]);

  return apiSuccess({
    instructors: instructors.map((i) => ({ id: i.id, name: `${i.user.firstName} ${i.user.lastName}` })),
    competencies: competencies.map((c) => ({ id: c.id, code: c.code, title: c.title })),
    trainees: trainees.rows.map((t) => ({
      id: t.id,
      studentNumber: t.studentNumber,
      name: `${t.user.firstName} ${t.user.lastName}`,
    })),
  });
}
