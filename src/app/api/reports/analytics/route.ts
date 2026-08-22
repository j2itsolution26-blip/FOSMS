import { apiSuccess } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/config/permissions";
import {
  getAnalyticsKpis,
  getAssessmentResultsChart,
  getAttendanceTrendChart,
  getCashieringChart,
  getCompetencyCompletionChart,
  getFrontOfficeActivityChart,
  getOccupancyChart,
  getReservationTrendChart,
  getTrainingStatusChart,
} from "@/services/report.service";

export async function GET() {
  const auth = await authorize(PERMISSIONS.REPORTS_VIEW);
  if (auth.error) return auth.error;

  const [kpis, competencyCompletion, assessmentResults, trainingStatus, attendanceTrend, reservationTrend, occupancy, frontOfficeActivity, cashiering] =
    await Promise.all([
      getAnalyticsKpis(),
      getCompetencyCompletionChart(),
      getAssessmentResultsChart(),
      getTrainingStatusChart(),
      getAttendanceTrendChart(14),
      getReservationTrendChart(14),
      getOccupancyChart(),
      getFrontOfficeActivityChart(14),
      getCashieringChart(14),
    ]);

  return apiSuccess({
    kpis,
    competencyCompletion,
    assessmentResults,
    trainingStatus,
    attendanceTrend,
    reservationTrend,
    occupancy,
    frontOfficeActivity,
    cashiering,
  });
}
