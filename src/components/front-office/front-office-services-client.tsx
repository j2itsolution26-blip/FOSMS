"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  LogIn,
  LogOut,
  ArrowLeftRight,
  BadgeCheck,
  UserPlus,
  Users,
  DoorOpen,
  CalendarPlus,
  Receipt,
  Wallet,
  Undo2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiFetch, type PaginationMeta } from "@/lib/api-client";
import { FrontOfficeModuleLayout } from "@/components/modules/front-office-module-layout";
import { ModuleEmptyState } from "@/components/modules/module-empty-state";
import type { ModuleColumn, ModuleFilterSelect } from "@/components/modules/types";

import { CheckInDialog } from "@/components/front-office/check-in-dialog";
import { CheckOutDialog } from "@/components/front-office/check-out-dialog";
import { RoomTransferDialog } from "@/components/front-office/room-transfer-dialog";
import { GuestVerificationDialog } from "@/components/front-office/guest-verification-dialog";
import { WalkInDialog } from "@/components/front-office/walk-in-dialog";
import { FrontOfficeActivityActionsMenu } from "@/components/front-office/front-office-activity-actions-menu";
import { TransactionDetailsDialog } from "@/components/cashiering/transaction-details-dialog";
import type { FrontOfficeActivityRow, FrontOfficeActivityType } from "@/services/front-office.service";

type Summary = {
  kpis: { todaysCheckIns: number; todaysCheckOuts: number; inHouseGuests: number; pendingRequests: number };
  operations: FrontOfficeActivityRow[];
  meta: PaginationMeta;
  filterOptions: { activityTypes: FrontOfficeActivityType[]; staff: string[] };
  activity: { id: string; time: string; action: string; label: string }[];
};

const STATUS_META: Record<FrontOfficeActivityRow["status"], { label: string; className: string }> = {
  AWAITING_CHECK_IN: { label: "Awaiting Check-in", className: "bg-amber-100 text-amber-800 border-amber-200" },
  AWAITING_CHECK_OUT: { label: "Awaiting Check-out", className: "bg-blue-100 text-blue-800 border-blue-200" },
  COMPLETED: { label: "Completed", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
};

// Subtle, semantic — reuses the same Charge=amber/Payment=emerald/Refund=red
// convention Cashiering already uses, so an activity reads the same color
// everywhere in the app rather than inventing a second palette.
const ACTIVITY_META: Record<FrontOfficeActivityType, { icon: LucideIcon; className: string }> = {
  Arrival: { icon: LogIn, className: "bg-slate-100 text-slate-700 border-slate-200" },
  Departure: { icon: LogOut, className: "bg-slate-100 text-slate-700 border-slate-200" },
  "Check-in": { icon: LogIn, className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  "Check-out": { icon: LogOut, className: "bg-blue-50 text-blue-700 border-blue-200" },
  "Room Transfer": { icon: ArrowLeftRight, className: "bg-violet-50 text-violet-700 border-violet-200" },
  "Guest Verification": { icon: BadgeCheck, className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  Reservation: { icon: CalendarPlus, className: "bg-blue-50 text-blue-700 border-blue-200" },
  Charge: { icon: Receipt, className: "bg-amber-50 text-amber-700 border-amber-200" },
  Payment: { icon: Wallet, className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  Refund: { icon: Undo2, className: "bg-red-50 text-red-700 border-red-200" },
};

const RANGE_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
];

// How the reservation behind this activity was created — distinct from
// Status (operation state) above. "UNKNOWN" covers rows from before this
// field existed, or with no reservation to trace back to.
const GUEST_TYPE_META: Record<string, { label: string; className: string }> = {
  RESERVATION: { label: "Reservation", className: "bg-blue-50 text-blue-700 border-blue-200" },
  WALK_IN: { label: "Walk-In", className: "bg-violet-50 text-violet-700 border-violet-200" },
  UNKNOWN: { label: "Unknown", className: "bg-slate-100 text-slate-600 border-slate-200" },
};

const GUEST_TYPE_FILTER_OPTIONS = [
  { value: "RESERVATION", label: "Reservation" },
  { value: "WALK_IN", label: "Walk-In" },
  { value: "UNKNOWN", label: "Unknown" },
];

function ActivityBadge({ activity }: { activity: FrontOfficeActivityType }) {
  const meta = ACTIVITY_META[activity];
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={`gap-1 font-medium ${meta.className}`}>
      <Icon className="h-3 w-3" /> {activity}
    </Badge>
  );
}

function GuestTypeBadge({ guestType }: { guestType: FrontOfficeActivityRow["guestType"] }) {
  const meta = GUEST_TYPE_META[guestType ?? "UNKNOWN"];
  return (
    <Badge variant="outline" className={`font-medium ${meta.className}`}>
      {meta.label}
    </Badge>
  );
}

export function FrontOfficeServicesClient({
  canManage,
  canViewReservations,
  canViewGuests,
  canViewRooms,
  canViewCashiering,
}: {
  canManage: boolean;
  canViewReservations: boolean;
  canViewGuests: boolean;
  canViewRooms: boolean;
  canViewCashiering: boolean;
}) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [activityFilter, setActivityFilter] = useState("");
  const [staffFilter, setStaffFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [guestTypeFilter, setGuestTypeFilter] = useState("");
  const [rangeFilter, setRangeFilter] = useState("today");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);

  const [dialog, setDialog] = useState<
    "check-in" | "check-out" | "transfer" | "verify" | "walk-in" | null
  >(null);
  const [prefillReservationId, setPrefillReservationId] = useState<string | null>(null);
  const [viewingTransaction, setViewingTransaction] = useState<FrontOfficeActivityRow["transaction"]>(null);

  const load = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setRefreshing(true);
      else setLoading(true);
      const params = new URLSearchParams({ page: String(page), pageSize: "25", range: rangeFilter });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (activityFilter) params.set("activityType", activityFilter);
      if (staffFilter) params.set("staff", staffFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (guestTypeFilter) params.set("guestType", guestTypeFilter);
      const result = await apiFetch<Summary>(`/api/front-office/summary?${params.toString()}`);
      if (result.success) setSummary(result.data);
      setLoading(false);
      setRefreshing(false);
    },
    [debouncedSearch, activityFilter, staffFilter, statusFilter, guestTypeFilter, rangeFilter, page]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, activityFilter, staffFilter, statusFilter, guestTypeFilter, rangeFilter]);

  function openDialog(name: typeof dialog, reservationId?: string) {
    setPrefillReservationId(reservationId ?? null);
    setDialog(name);
  }

  const filters: ModuleFilterSelect[] = [
    {
      label: "Activity",
      value: activityFilter,
      placeholder: "All Activities",
      onChange: setActivityFilter,
      options: (summary?.filterOptions.activityTypes ?? []).map((a) => ({ value: a, label: a })),
    },
    {
      label: "Guest Type",
      value: guestTypeFilter,
      placeholder: "All Guest Types",
      onChange: setGuestTypeFilter,
      options: GUEST_TYPE_FILTER_OPTIONS,
    },
    {
      label: "Staff",
      value: staffFilter,
      placeholder: "All Staff",
      onChange: setStaffFilter,
      options: (summary?.filterOptions.staff ?? []).map((s) => ({ value: s, label: s })),
    },
    {
      label: "Status",
      value: statusFilter,
      placeholder: "All Status",
      onChange: setStatusFilter,
      options: Object.entries(STATUS_META).map(([value, meta]) => ({ value, label: meta.label })),
    },
    {
      label: "Date",
      // "today" is the page's natural default, not a user-applied filter —
      // keep the select showing its placeholder (and Clear Filters hidden)
      // until they actually pick something else.
      value: rangeFilter === "today" ? "" : rangeFilter,
      placeholder: "Today",
      onChange: (v) => setRangeFilter(v || "today"),
      options: RANGE_OPTIONS.filter((o) => o.value !== "today"),
    },
  ];

  const columns: ModuleColumn<FrontOfficeActivityRow>[] = [
    {
      key: "guest",
      header: "Guest",
      render: (r) =>
        r.guestId && canViewGuests ? (
          <Link href={`/guests?guestId=${r.guestId}`} className="font-medium text-blue-600 hover:underline">
            {r.guestName}
          </Link>
        ) : (
          <span className="font-medium">{r.guestName}</span>
        ),
    },
    {
      key: "guestType",
      header: "Guest Type",
      render: (r) => <GuestTypeBadge guestType={r.guestType} />,
    },
    {
      key: "room",
      header: "Room",
      render: (r) =>
        r.roomId && canViewRooms ? (
          <Link href={`/rooms?roomId=${r.roomId}`} className="text-blue-600 hover:underline">
            {r.roomNumber}
          </Link>
        ) : (
          r.roomNumber
        ),
    },
    { key: "activity", header: "Activity", render: (r) => <ActivityBadge activity={r.activity} /> },
    {
      key: "time",
      header: "Time",
      render: (r) =>
        rangeFilter === "today"
          ? new Date(r.time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
          : new Date(r.time).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
    },
    { key: "staff", header: "Staff", render: (r) => r.staff },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <Badge variant="outline" className={STATUS_META[r.status].className}>
          {STATUS_META[r.status].label}
        </Badge>
      ),
    },
    {
      key: "action",
      header: "Action",
      className: "text-right",
      render: (r) => (
        <div className="flex items-center justify-end gap-2">
          {canManage && r.status === "AWAITING_CHECK_IN" ? (
            <Button size="sm" variant="outline" onClick={() => openDialog("check-in", r.reservationId ?? undefined)}>
              Check In
            </Button>
          ) : null}
          {canManage && r.status === "AWAITING_CHECK_OUT" ? (
            <Button size="sm" variant="outline" onClick={() => openDialog("check-out", r.reservationId ?? undefined)}>
              Check Out
            </Button>
          ) : null}
          <FrontOfficeActivityActionsMenu
            row={r}
            canViewReservations={canViewReservations}
            canViewGuests={canViewGuests}
            canViewCashiering={canViewCashiering}
            onViewTransaction={() => setViewingTransaction(r.transaction)}
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <FrontOfficeModuleLayout<FrontOfficeActivityRow>
        title="Front Office Services"
        description="Check-in, check-out, room transfers, and guest verification."
        breadcrumb={["Dashboard", "Operations", "Front Office Services"]}
        onRefresh={() => load(true)}
        refreshing={refreshing}
        kpis={
          summary
            ? [
                { label: "Today's Check-ins", value: summary.kpis.todaysCheckIns, unit: "Guests", icon: LogIn, tone: "blue" },
                { label: "Today's Check-outs", value: summary.kpis.todaysCheckOuts, unit: "Guests", icon: LogOut, tone: "amber" },
                { label: "In-House Guests", value: summary.kpis.inHouseGuests, unit: "Guests", icon: Users, tone: "green" },
              ]
            : []
        }
        quickActions={
          canManage
            ? [
                { label: "Check-In", icon: LogIn, tone: "bg-blue-50 text-blue-700", onClick: () => openDialog("check-in") },
                { label: "Check-Out", icon: LogOut, tone: "bg-amber-50 text-amber-700", onClick: () => openDialog("check-out") },
                { label: "Room Transfer", icon: ArrowLeftRight, tone: "bg-violet-50 text-violet-700", onClick: () => openDialog("transfer") },
                { label: "Guest Verification", icon: BadgeCheck, tone: "bg-emerald-50 text-emerald-700", onClick: () => openDialog("verify") },
                { label: "Walk-In Guest", icon: UserPlus, tone: "bg-slate-100 text-slate-700", onClick: () => openDialog("walk-in") },
              ]
            : []
        }
        search={{ value: search, onChange: setSearch, placeholder: "Search guest, room, reservation #, transaction #, guest type…" }}
        filters={filters}
        onClearFilters={() => {
          setActivityFilter("");
          setStaffFilter("");
          setStatusFilter("");
          setGuestTypeFilter("");
          setRangeFilter("today");
        }}
        tableTitle={rangeFilter === "today" ? "Today's Front Office Operations" : "Front Office Operations"}
        columns={columns}
        rows={summary?.operations ?? []}
        loading={loading}
        meta={summary?.meta ?? null}
        onPageChange={setPage}
        emptyState={
          <ModuleEmptyState
            icon={DoorOpen}
            title="No front office activity found"
            description="Arrivals, departures, check-ins/outs, reservations, and payments for the selected filters will appear here."
            actionLabel={canManage ? "Walk-In Guest" : undefined}
            onAction={canManage ? () => openDialog("walk-in") : undefined}
          />
        }
        activityTitle="Recent Activity"
        activityItems={(summary?.activity ?? []).map((a) => ({
          id: a.id,
          time: new Date(a.time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
          label: a.label,
          icon: LogIn,
          tone: "bg-blue-100 text-blue-600",
        }))}
      />

      <CheckInDialog
        open={dialog === "check-in"}
        onOpenChange={(o) => setDialog(o ? "check-in" : null)}
        onDone={() => load()}
        initialReservationId={prefillReservationId}
      />
      <CheckOutDialog
        open={dialog === "check-out"}
        onOpenChange={(o) => setDialog(o ? "check-out" : null)}
        onDone={() => load()}
        initialReservationId={prefillReservationId}
      />
      <RoomTransferDialog open={dialog === "transfer"} onOpenChange={(o) => setDialog(o ? "transfer" : null)} onDone={() => load()} />
      <GuestVerificationDialog open={dialog === "verify"} onOpenChange={(o) => setDialog(o ? "verify" : null)} onDone={() => load()} />
      <WalkInDialog open={dialog === "walk-in"} onOpenChange={(o) => setDialog(o ? "walk-in" : null)} onDone={() => load()} />
      <TransactionDetailsDialog
        transaction={viewingTransaction}
        open={!!viewingTransaction}
        onOpenChange={(o) => !o && setViewingTransaction(null)}
        canViewReservations={canViewReservations}
        canViewGuests={canViewGuests}
        canViewRooms={canViewRooms}
        canTransact={false}
        onTransact={() => {}}
      />
    </>
  );
}
