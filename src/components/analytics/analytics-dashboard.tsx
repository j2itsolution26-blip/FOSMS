"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Users,
  TrendingUp,
  Award,
  CheckCircle2,
  CalendarCheck,
  BedDouble,
  ClipboardCheck,
} from "lucide-react";

import { ModuleHeader } from "@/components/modules/module-header";
import { ModuleKpiGrid } from "@/components/modules/module-kpi-grid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api-client";
import type { ModuleKpi } from "@/components/modules/types";
import { CompetencyCompletionChart } from "@/components/analytics/competency-completion-chart";
import { AssessmentResultsChart } from "@/components/analytics/assessment-results-chart";
import { TrainingStatusChart } from "@/components/analytics/training-status-chart";
import { AttendanceTrendChart } from "@/components/analytics/attendance-trend-chart";
import { ReservationStatusTrendChart } from "@/components/analytics/reservation-status-trend-chart";
import { FrontOfficeActivityChart } from "@/components/analytics/front-office-activity-chart";
import { CashieringChart } from "@/components/analytics/cashiering-chart";
import { RoomStatusChart } from "@/components/dashboard/room-status-chart";
import { ReportBuilder } from "@/components/analytics/report-builder";

type AnalyticsData = {
  kpis: {
    totalTrainees: number;
    competencyCompletion: number;
    competentRate: number;
    assessmentCompletion: number;
    attendanceRate: number;
    activeReservations: number;
    roomOccupancyRate: number;
  };
  competencyCompletion: { code: string; title: string; completion: number }[];
  assessmentResults: { competent: number; notYetCompetent: number; pending: number };
  trainingStatus: { status: string; count: number }[];
  attendanceTrend: { date: string; label: string; attendanceRate: number }[];
  reservationTrend: { date: string; label: string; confirmed: number; cancelled: number; noShow: number }[];
  occupancy: { total: number; byStatus: Record<string, number> };
  frontOfficeActivity: { checkIns: number; checkOuts: number; transfers: number; requests: number };
  cashiering: {
    byType: { type: string; amount: number; count: number }[];
    byMethod: { method: string | null; amount: number }[];
  };
};

export function AnalyticsDashboard({ canExport }: { canExport: boolean }) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    else setLoading(true);
    const res = await apiFetch<AnalyticsData>("/api/reports/analytics");
    if (res.success) setData(res.data);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const kpis: ModuleKpi[] = data
    ? [
        { label: "Total Trainees", value: data.kpis.totalTrainees, unit: "Enrolled", icon: Users, tone: "blue" },
        { label: "Competency Completion", value: `${data.kpis.competencyCompletion}%`, unit: "Average progress", icon: TrendingUp, tone: "purple" },
        { label: "Competent Rate", value: `${data.kpis.competentRate}%`, unit: "Of completed assessments", icon: Award, tone: "green" },
        { label: "Assessment Completion", value: `${data.kpis.assessmentCompletion}%`, unit: "Of all assessments", icon: ClipboardCheck, tone: "amber" },
        { label: "Attendance Rate", value: `${data.kpis.attendanceRate}%`, unit: "Last 30 days", icon: CalendarCheck, tone: "blue" },
        { label: "Active Reservations", value: data.kpis.activeReservations, unit: "Pending / confirmed / in-house", icon: BedDouble, tone: "purple" },
        { label: "Room Occupancy", value: `${data.kpis.roomOccupancyRate}%`, unit: "Rooms occupied", icon: CheckCircle2, tone: "green" },
      ]
    : [];

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="print:hidden">
        <ModuleHeader
          title="Reports & Analytics"
          description="Training, assessment, and operational performance across the Front Office Servicing NC II program."
          breadcrumb={["Dashboard", "Reports & Analytics"]}
          onRefresh={() => load(true)}
          refreshing={refreshing}
        />
      </div>

      <div className="print:hidden">
        <ModuleKpiGrid kpis={kpis} />
      </div>

      {loading || !data ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-72 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 print:hidden lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Competency Completion</CardTitle>
            </CardHeader>
            <CardContent>
              <CompetencyCompletionChart data={data.competencyCompletion} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Assessment Results</CardTitle>
            </CardHeader>
            <CardContent>
              <AssessmentResultsChart data={data.assessmentResults} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Trainee Status Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <TrainingStatusChart data={data.trainingStatus} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Attendance Trend (14 days)</CardTitle>
            </CardHeader>
            <CardContent>
              <AttendanceTrendChart data={data.attendanceTrend} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reservation Trend (14 days)</CardTitle>
            </CardHeader>
            <CardContent>
              <ReservationStatusTrendChart data={data.reservationTrend} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Room Occupancy</CardTitle>
            </CardHeader>
            <CardContent>
              <RoomStatusChart total={data.occupancy.total} byStatus={data.occupancy.byStatus} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Front Office Activity (14 days)</CardTitle>
            </CardHeader>
            <CardContent>
              <FrontOfficeActivityChart data={data.frontOfficeActivity} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cashiering (14 days)</CardTitle>
            </CardHeader>
            <CardContent>
              <CashieringChart byType={data.cashiering.byType} byMethod={data.cashiering.byMethod} />
            </CardContent>
          </Card>
        </div>
      )}

      <ReportBuilder canExport={canExport} />
    </div>
  );
}
