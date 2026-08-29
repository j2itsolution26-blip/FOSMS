import Link from "next/link";
import {
  Percent,
  LogIn,
  LogOut,
  Users,
  BedDouble,
  AlertTriangle,
  Sunrise,
  Moon,
  ArrowLeftRight,
  Clock3,
  UserX,
  DoorClosed,
  ClipboardList,
  ShieldCheck,
} from "lucide-react";

import { KpiCard } from "@/components/dashboard/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReservationStatusBadge, RoomStatusBadge } from "@/components/shared/status-badge";
import { ROOM_STATUS_ORDER } from "@/config/room-status";
import type {
  getSupervisorKpis,
  getTodaysOperationsSummary,
  getTodaysArrivals,
  getTodaysDepartures,
  getReservationOverview,
  getStaffOnDuty,
  getGuestIssues,
  getRecentFrontOfficeActivity,
} from "@/services/supervisor-dashboard.service";

type Props = {
  firstName: string;
  kpis: Awaited<ReturnType<typeof getSupervisorKpis>>;
  ops: Awaited<ReturnType<typeof getTodaysOperationsSummary>>;
  arrivals: Awaited<ReturnType<typeof getTodaysArrivals>>;
  departures: Awaited<ReturnType<typeof getTodaysDepartures>>;
  reservationOverview: Awaited<ReturnType<typeof getReservationOverview>>;
  staffOnDuty: Awaited<ReturnType<typeof getStaffOnDuty>>;
  guestIssues: Awaited<ReturnType<typeof getGuestIssues>>;
  activity: Awaited<ReturnType<typeof getRecentFrontOfficeActivity>>;
};

const PRIORITY_STYLES: Record<string, string> = {
  URGENT: "bg-red-100 text-red-800 border-red-200",
  HIGH: "bg-red-100 text-red-800 border-red-200",
  NORMAL: "bg-amber-100 text-amber-800 border-amber-200",
  LOW: "bg-slate-100 text-slate-700 border-slate-200",
};

const REQUEST_STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-700 border-slate-200",
  ASSIGNED: "bg-blue-100 text-blue-800 border-blue-200",
  IN_PROGRESS: "bg-amber-100 text-amber-800 border-amber-200",
  COMPLETED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  CANCELLED: "bg-slate-200 text-slate-800 border-slate-300",
};

function toLabel(s: string) {
  return s
    .split("_")
    .map((w) => w[0] + w.slice(1).toLowerCase())
    .join(" ");
}

function formatTime(date: Date | string) {
  return new Date(date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatDateTime(date: Date | string) {
  return new Date(date).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const ACTIVITY_LABELS: Record<string, string> = {
  CHECK_IN: "Guest checked in",
  CHECK_OUT: "Guest checked out",
  ROOM_TRANSFER: "Room changed",
  GUEST_VERIFICATION: "Guest verified",
  WALK_IN: "Walk-in guest registered",
  CREATE: "Reservation created",
  UPDATE: "Record updated",
  CANCEL: "Reservation cancelled",
  SERVICE_REQUEST_CREATED: "Guest issue reported",
  SERVICE_REQUEST_ASSIGNED: "Guest issue assigned",
  SERVICE_REQUEST_COMPLETED: "Guest issue resolved",
};

export function SupervisorDashboard({
  firstName,
  kpis,
  ops,
  arrivals,
  departures,
  reservationOverview,
  staffOnDuty,
  guestIssues,
  activity,
}: Props) {
  const now = new Date();
  const attentionIssues = guestIssues.requests.filter((r) => r.priority === "HIGH" || r.priority === "URGENT");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
            {greeting()}, {firstName}
          </p>
          <h1 className="text-2xl font-bold text-slate-900">Front Office Supervisor</h1>
          <p className="text-sm text-muted-foreground">Daily Operations Overview</p>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>
            {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })} ·{" "}
            {formatTime(now)}
          </span>
          <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700">
            <ShieldCheck className="h-3 w-3" aria-hidden /> All systems operational
          </Badge>
        </div>
      </div>

      {/* Operational alerts (priority 1) */}
      {attentionIssues.length > 0 ? (
        <Card className="border-red-200 bg-red-50/60">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-red-800">
                {attentionIssues.length} guest issue{attentionIssues.length === 1 ? "" : "s"} need{attentionIssues.length === 1 ? "s" : ""} attention
              </p>
              <p className="text-xs text-red-700/80">High or urgent priority requests are still open. See Guest Issues below.</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* KPI cards (priority 3: occupancy/rooms, plus arrivals/departures/issues) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Occupancy Today" value={`${kpis.occupancyRate}%`} unit="Of total rooms" icon={Percent} tone="blue" />
        <KpiCard label="Arrivals Today" value={kpis.arrivalsToday} unit="Expected" icon={LogIn} tone="green" />
        <KpiCard label="Departures Today" value={kpis.departuresToday} unit="Expected" icon={LogOut} tone="amber" />
        <KpiCard label="In-House Guests" value={kpis.inHouseGuests} unit="Currently staying" icon={Users} tone="purple" />
        <KpiCard label="Available Rooms" value={kpis.availableRooms} unit="Ready for assignment" icon={BedDouble} tone="green" />
        <KpiCard
          label="Guest Issues"
          value={kpis.openServiceIssues}
          unit="Open requests"
          icon={AlertTriangle}
          tone={kpis.openServiceIssues > 0 ? "amber" : "green"}
        />
      </div>

      {/* Today's front office operations */}
      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s Front Office Operations</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <OpsStat icon={LogIn} label="Arrivals" value={ops.arrivalsToday} />
          <OpsStat icon={LogOut} label="Departures" value={ops.departuresToday} />
          <OpsStat icon={Sunrise} label="Early Check-ins" value={ops.earlyCheckIns} />
          <OpsStat icon={Moon} label="Late Check-outs" value={ops.lateCheckOuts} />
          <OpsStat icon={ArrowLeftRight} label="Room Changes" value={ops.roomChangesToday} />
          <OpsStat icon={Clock3} label="Pending Reservations" value={ops.pendingReservations} />
          <OpsStat icon={UserX} label="No-Shows" value={ops.noShowsToday} />
          <OpsStat icon={DoorClosed} label="Walk-ins Today" value={ops.walkInsToday} />
        </CardContent>
      </Card>

      {/* Arrivals & Departures (priority 2) */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s Arrivals</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {arrivals.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No arrivals scheduled today.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Guest</TableHead>
                      <TableHead>Room</TableHead>
                      <TableHead>Expected</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {arrivals.slice(0, 8).map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          <p className="font-medium">{a.guestName}</p>
                          <p className="font-mono text-xs text-muted-foreground">{a.reservationNo}</p>
                        </TableCell>
                        <TableCell>{a.roomNumber}</TableCell>
                        <TableCell>{formatTime(a.expectedArrival)}</TableCell>
                        <TableCell>
                          <ReservationStatusBadge status={a.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild size="sm" variant="ghost">
                            <Link href="/reservations">View</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s Departures</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {departures.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No departures scheduled today.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Guest</TableHead>
                      <TableHead>Room</TableHead>
                      <TableHead>Departure</TableHead>
                      <TableHead>Folio</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {departures.slice(0, 8).map((d) => (
                      <TableRow key={d.id}>
                        <TableCell>
                          <p className="font-medium">{d.guestName}</p>
                          <p className="font-mono text-xs text-muted-foreground">{d.reservationNo}</p>
                        </TableCell>
                        <TableCell>{d.roomNumber}</TableCell>
                        <TableCell>{formatTime(d.departureTime)}</TableCell>
                        <TableCell>
                          {d.balance > 0 ? (
                            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                              Outstanding ₱{d.balance.toFixed(2)}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Settled</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <ReservationStatusBadge status={d.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild size="sm" variant="ghost">
                            <Link href="/cashiering">Folio</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Room status (priority 3) */}
      <Card>
        <CardHeader>
          <CardTitle>Room Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {ROOM_STATUS_ORDER.filter((status) => (kpis.roomSummary.byStatus[status] ?? 0) > 0).map((status) => (
              <div key={status} className="rounded-lg border p-3">
                <RoomStatusBadge status={status} />
                <p className="mt-2 text-2xl font-bold text-slate-900">{kpis.roomSummary.byStatus[status] ?? 0}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Staff currently signed in (priority 4) */}
        <Card>
          <CardHeader>
            <CardTitle>Staff Currently Signed In</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {staffOnDuty.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No staff currently signed in.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Signed In</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staffOnDuty.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          <p className="font-medium">{s.name}</p>
                          <p className="text-xs text-muted-foreground">{s.email}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{s.role}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDateTime(s.signedInSince)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <p className="border-t px-4 py-2 text-xs text-muted-foreground">
              Reflects active login sessions, not a shift schedule — shift/attendance tracking for staff isn&apos;t implemented yet.
            </p>
          </CardContent>
        </Card>

        {/* Guest issues (priority 5) */}
        <Card>
          <CardHeader>
            <CardTitle>Guest Issues</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {guestIssues.requests.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No open guest issues.</p>
            ) : (
              <div className="divide-y">
                {guestIssues.requests.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={PRIORITY_STYLES[r.priority]}>{r.priority}</Badge>
                        <p className="truncate text-sm font-medium">{toLabel(r.type)}</p>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.guest ? `${r.guest.firstName} ${r.guest.lastName}` : "—"}
                        {r.roomNumber ? ` · Room ${r.roomNumber}` : ""} · {formatTime(r.createdAt)}
                      </p>
                    </div>
                    <Badge variant="outline" className={REQUEST_STATUS_STYLES[r.status]}>{toLabel(r.status)}</Badge>
                  </div>
                ))}
              </div>
            )}
            <div className="border-t p-3">
              <Button asChild size="sm" variant="outline">
                <Link href="/concierge">View All Guest Issues</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reservation overview (priority 6) */}
      <Card>
        <CardHeader>
          <CardTitle>Reservation Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {(["CONFIRMED", "PENDING", "CANCELLED", "NO_SHOW", "CHECKED_IN", "CHECKED_OUT"] as const).map((status) => (
              <div key={status} className="rounded-lg border p-3">
                <ReservationStatusBadge status={status} />
                <p className="mt-2 text-2xl font-bold text-slate-900">{reservationOverview.byStatus[status] ?? 0}</p>
              </div>
            ))}
            <div className="rounded-lg border p-3">
              <Badge variant="outline">Walk-in</Badge>
              <p className="mt-2 text-2xl font-bold text-slate-900">{reservationOverview.walkInToday}</p>
              <p className="text-xs text-muted-foreground">Today</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent activity (priority 7) */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Front Office Activity</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {activity.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No recent activity.</p>
          ) : (
            <div className="divide-y">
              {activity.map((a) => (
                <div key={a.id} className="flex items-start gap-3 px-4 py-2.5">
                  <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">{ACTIVITY_LABELS[a.action] ?? toLabel(a.action)}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.user ? `${a.user.firstName} ${a.user.lastName}` : "System"} · {formatDateTime(a.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick actions (priority 8) */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/reservations">New Reservation</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/guests">Guest Directory</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/rooms">Room Status</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/concierge">Guest Issues</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/reports">Daily Report</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function OpsStat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <Icon className="h-4.5 w-4.5" aria-hidden />
      </div>
      <div>
        <p className="text-lg font-bold text-slate-900">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
