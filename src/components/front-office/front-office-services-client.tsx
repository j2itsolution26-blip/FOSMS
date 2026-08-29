"use client";

import { useCallback, useEffect, useState } from "react";
import {
  LogIn,
  LogOut,
  ArrowLeftRight,
  BadgeCheck,
  UserPlus,
  Users,
  DoorOpen,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiFetch } from "@/lib/api-client";
import { FrontOfficeModuleLayout } from "@/components/modules/front-office-module-layout";
import { ModuleEmptyState } from "@/components/modules/module-empty-state";
import type { ModuleColumn } from "@/components/modules/types";

import { CheckInDialog } from "@/components/front-office/check-in-dialog";
import { CheckOutDialog } from "@/components/front-office/check-out-dialog";
import { RoomTransferDialog } from "@/components/front-office/room-transfer-dialog";
import { GuestVerificationDialog } from "@/components/front-office/guest-verification-dialog";
import { WalkInDialog } from "@/components/front-office/walk-in-dialog";

type Operation = {
  id: string;
  guestName: string;
  roomNumber: string;
  transaction: string;
  time: string;
  staff: string;
  status: "AWAITING_CHECK_IN" | "AWAITING_CHECK_OUT" | "COMPLETED";
  reservationId: string;
};

type Summary = {
  kpis: { todaysCheckIns: number; todaysCheckOuts: number; inHouseGuests: number; pendingRequests: number };
  operations: Operation[];
  activity: { id: string; time: string; action: string; label: string }[];
};

const STATUS_META: Record<Operation["status"], { label: string; className: string }> = {
  AWAITING_CHECK_IN: { label: "Awaiting Check-in", className: "bg-amber-100 text-amber-800 border-amber-200" },
  AWAITING_CHECK_OUT: { label: "Awaiting Check-out", className: "bg-blue-100 text-blue-800 border-blue-200" },
  COMPLETED: { label: "Completed", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
};

export function FrontOfficeServicesClient({ canManage }: { canManage: boolean }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);

  const [dialog, setDialog] = useState<
    "check-in" | "check-out" | "transfer" | "verify" | "walk-in" | null
  >(null);
  const [prefillReservationId, setPrefillReservationId] = useState<string | null>(null);

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    else setLoading(true);
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    const result = await apiFetch<Summary>(`/api/front-office/summary?${params.toString()}`);
    if (result.success) setSummary(result.data);
    setLoading(false);
    setRefreshing(false);
  }, [debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  function openDialog(name: typeof dialog, reservationId?: string) {
    setPrefillReservationId(reservationId ?? null);
    setDialog(name);
  }

  const columns: ModuleColumn<Operation>[] = [
    { key: "guest", header: "Guest", render: (r) => <span className="font-medium">{r.guestName}</span> },
    { key: "room", header: "Room", render: (r) => r.roomNumber },
    { key: "transaction", header: "Transaction", render: (r) => r.transaction },
    { key: "time", header: "Time", render: (r) => new Date(r.time).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) },
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
      render: (r) => {
        if (!canManage) return null;
        if (r.status === "AWAITING_CHECK_IN") {
          return (
            <Button size="sm" variant="outline" onClick={() => openDialog("check-in", r.reservationId)}>
              Check In
            </Button>
          );
        }
        if (r.status === "AWAITING_CHECK_OUT") {
          return (
            <Button size="sm" variant="outline" onClick={() => openDialog("check-out", r.reservationId)}>
              Check Out
            </Button>
          );
        }
        return null;
      },
    },
  ];

  return (
    <>
      <FrontOfficeModuleLayout<Operation>
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
        search={{ value: search, onChange: setSearch, placeholder: "Search guest, room, reservation…" }}
        filters={[]}
        onClearFilters={() => {}}
        tableTitle="Today's Front Office Operations"
        columns={columns}
        rows={summary?.operations ?? []}
        loading={loading}
        meta={null}
        onPageChange={() => {}}
        emptyState={
          <ModuleEmptyState
            icon={DoorOpen}
            title="No front office activity today"
            description="Arrivals, departures, and check-in/out actions for today will appear here."
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
    </>
  );
}
