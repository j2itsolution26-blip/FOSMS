import type { Metadata } from "next";
import { CalendarDays, DoorOpen, LogOut, Users } from "lucide-react";

import { getCurrentUser, hasPermission } from "@/lib/auth/session";
import { PERMISSIONS, type PermissionKey } from "@/config/permissions";
import { getDashboardSummary, getTodaysActivities } from "@/services/dashboard.service";
import { getMyDashboard } from "@/services/trainee-portal.service";
import {
  getSupervisorKpis,
  getTodaysOperationsSummary,
  getTodaysArrivals,
  getTodaysDepartures,
  getReservationOverview,
  getStaffOnDuty,
  getGuestIssues,
  getRecentFrontOfficeActivity,
} from "@/services/supervisor-dashboard.service";
import { prisma } from "@/lib/prisma";

import { TraineeDashboard } from "@/components/trainee-portal/trainee-dashboard";
import { SupervisorDashboard } from "@/components/supervisor/supervisor-dashboard";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ReservationTrendChart } from "@/components/dashboard/reservation-trend-chart";
import { RoomStatusChart } from "@/components/dashboard/room-status-chart";
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

  // Front Office Supervisors get a real-hotel-operations command center, not the
  // training-centric staff dashboard below — same early-branch pattern as TRAINEE.
  if (user?.roles[0] === "SUPERVISOR") {
    const [kpis, ops, arrivals, departures, reservationOverview, staffOnDuty, guestIssues, activity] = await Promise.all([
      getSupervisorKpis(),
      getTodaysOperationsSummary(),
      getTodaysArrivals(),
      getTodaysDepartures(),
      getReservationOverview(),
      getStaffOnDuty(),
      getGuestIssues(),
      getRecentFrontOfficeActivity(),
    ]);
    return (
      <SupervisorDashboard
        firstName={user.firstName}
        kpis={kpis}
        ops={ops}
        arrivals={arrivals}
        departures={departures}
        reservationOverview={reservationOverview}
        staffOnDuty={staffOnDuty}
        guestIssues={guestIssues}
        activity={activity}
      />
    );
  }

  const [summary, activities] = await Promise.all([getDashboardSummary(), getTodaysActivities()]);

  const isFrontOffice =
    user?.roles[0] === "FRONT_OFFICE_STAFF" ||
    user?.roles[0]?.toUpperCase().startsWith("FRONT_OFFICE") ||
    user?.firstName?.toLowerCase() === "angela";
  const greetingName = isFrontOffice ? "Front Office" : user?.firstName;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Welcome back, {greetingName}!</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Today's Arrivals" value={summary.kpis.todaysArrivals} unit="Guests" icon={Users} tone="blue" />
        <KpiCard label="In-House Guests" value={summary.kpis.inHouseGuests} unit="Guests" icon={DoorOpen} tone="green" />
        <KpiCard label="Today's Departures" value={summary.kpis.todaysDepartures} unit="Guests" icon={LogOut} tone="amber" />
        <KpiCard label="Reservations" value={summary.kpis.reservationsToday} unit="Today" icon={CalendarDays} tone="purple" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Reservation Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <ReservationTrendChart data={summary.trend} />
          </CardContent>
        </Card>
        <RecentReservationsCard reservations={summary.recentReservations} />
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
