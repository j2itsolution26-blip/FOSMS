import type { Metadata } from "next";
import { CalendarDays, DoorOpen, LogOut, Users, GraduationCap, UserCheck, ClipboardCheck, ListChecks, ShieldCheck } from "lucide-react";

import { getCurrentUser, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS, type PermissionKey } from "@/config/permissions";
import {
  getCompetencyOverview,
  getDashboardSummary,
  getTodaysActivities,
  getTrainingProgramKpis,
} from "@/services/dashboard.service";
import { getTrainingActivityKpis } from "@/services/training-activity.service";
import { getMyDashboard } from "@/services/trainee-portal.service";
import { prisma } from "@/lib/prisma";

import { TraineeDashboard } from "@/components/trainee-portal/trainee-dashboard";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ReservationTrendChart } from "@/components/dashboard/reservation-trend-chart";
import { RoomStatusChart } from "@/components/dashboard/room-status-chart";
import { CoreCompetenciesCard } from "@/components/dashboard/core-competencies-card";
import { RecentReservationsCard } from "@/components/dashboard/recent-reservations-card";
import { TodaysActivitiesCard } from "@/components/dashboard/todays-activities-card";
import { QuickActionsCard } from "@/components/dashboard/quick-actions-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Dashboard — Front Office Servicing NC II" };

export default async function DashboardPage() {
  const user = await getCurrentUser();

  // Trainees get a dedicated training command-center dashboard, not the hotel
  // operations view — the two audiences need fundamentally different content
  // (AGENTS.md §4), so this branches before any of the staff-dashboard queries run.
  if (user?.roles[0] === "TRAINEE" && hasPermission(user, PERMISSIONS.TRAINEE_PORTAL_ACCESS)) {
    const trainee = await prisma.trainee.findUnique({ where: { userId: user.id, deletedAt: null }, select: { id: true } });
    if (trainee) {
      const dashboard = await getMyDashboard(trainee.id);
      return <TraineeDashboard dashboard={dashboard} firstName={user.firstName} />;
    }
  }

  const canViewTrainees = hasPermission(user, PERMISSIONS.TRAINEES_VIEW);
  const canViewAssessments = hasPermission(user, PERMISSIONS.ASSESSMENTS_VIEW);
  const canViewTrainingActivities = hasPermission(user, PERMISSIONS.TRAINING_ACTIVITIES_VIEW);
  const canManageUsers = hasPermission(user, PERMISSIONS.USERS_MANAGE);
  const showTrainingKpis = canViewTrainees || canViewAssessments || canManageUsers;

  const [summary, competencies, activities, trainingKpis, activityKpis] = await Promise.all([
    getDashboardSummary(),
    getCompetencyOverview(),
    getTodaysActivities(),
    showTrainingKpis ? getTrainingProgramKpis() : null,
    canViewTrainingActivities ? getTrainingActivityKpis() : null,
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Welcome back, {user?.firstName}!</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Today's Arrivals" value={summary.kpis.todaysArrivals} unit="Guests" icon={Users} tone="blue" />
        <KpiCard label="In-House Guests" value={summary.kpis.inHouseGuests} unit="Guests" icon={DoorOpen} tone="green" />
        <KpiCard label="Today's Departures" value={summary.kpis.todaysDepartures} unit="Guests" icon={LogOut} tone="amber" />
        <KpiCard label="Reservations" value={summary.kpis.reservationsToday} unit="Today" icon={CalendarDays} tone="purple" />
      </div>

      {trainingKpis ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {canViewTrainees ? (
            <>
              <KpiCard label="Total Trainees" value={trainingKpis.totalTrainees} unit="Enrolled" icon={GraduationCap} tone="blue" />
              <KpiCard label="Active Trainees" value={trainingKpis.activeTrainees} unit="Currently training" icon={UserCheck} tone="green" />
            </>
          ) : null}
          {canViewAssessments ? (
            <KpiCard label="Pending Assessments" value={trainingKpis.pendingAssessments} unit="Awaiting completion" icon={ClipboardCheck} tone="amber" />
          ) : null}
          {canViewTrainingActivities && activityKpis ? (
            <KpiCard label="Pending Training Activities" value={activityKpis.pendingSubmissions} unit="Awaiting completion" icon={ListChecks} tone="amber" />
          ) : null}
          {canManageUsers ? (
            <KpiCard label="System Users" value={trainingKpis.systemUsers} unit="Active staff accounts" icon={ShieldCheck} tone="purple" />
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Reservation Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <ReservationTrendChart data={summary.trend} />
          </CardContent>
        </Card>
        <div className="lg:col-span-1">
          <CoreCompetenciesCard competencies={competencies} />
        </div>
        <div className="lg:col-span-1">
          <RecentReservationsCard reservations={summary.recentReservations} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Room Status</CardTitle>
          </CardHeader>
          <CardContent>
            <RoomStatusChart total={summary.roomStatus.total} byStatus={summary.roomStatus.byStatus} />
          </CardContent>
        </Card>
        <TodaysActivitiesCard activities={activities} />
        <QuickActionsCard permissions={Array.from(user?.permissions ?? []) as PermissionKey[]} />
      </div>
    </div>
  );
}
