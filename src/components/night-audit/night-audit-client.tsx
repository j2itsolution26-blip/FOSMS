"use client";

import { useCallback, useEffect, useState } from "react";
import { Moon, Receipt, Wallet, ReceiptText, DoorOpen, LogIn, LogOut, BedDouble } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatGuestFullName } from "@/lib/formatters";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiFetch } from "@/lib/api-client";
import { FrontOfficeModuleLayout } from "@/components/modules/front-office-module-layout";
import { ModuleEmptyState } from "@/components/modules/module-empty-state";
import { NightAuditStatusBadge } from "@/components/shared/status-badge";
import type { ModuleColumn } from "@/components/modules/types";
import { NightAuditActionDialog } from "@/components/night-audit/night-audit-action-dialog";

type TransactionRow = {
  id: string;
  transactionNo: string;
  type: "CHARGE" | "PAYMENT" | "REFUND" | "DISCOUNT";
  amount: string;
  paymentMethod: string | null;
  createdAt: string;
  reservation: { reservationNo: string; guest: { firstName: string; middleName?: string | null; lastName: string } } | null;
  user: { firstName: string; lastName: string };
};

type ReservationRow = {
  id: string;
  reservationNo: string;
  guest: { firstName: string; middleName?: string | null; lastName: string };
  room: { number: string };
  arrivalDate?: string;
  departureDate?: string;
};

type Workbook = {
  audit: { id: string; status: string; openedAt: string; openedBy: { firstName: string; lastName: string } | null } | null;
  transactions: TransactionRow[];
  arrivals: ReservationRow[];
  departures: ReservationRow[];
  roomStatus: Record<string, number>;
  openSessions: { id: string; cashier: { firstName: string; lastName: string } }[];
  outstandingBalances: { id: string; reservationNo: string; guestName: string; balance: number }[];
  revenue: number;
  activity: { id: string; time: string; label: string; action: string }[];
};

function currency(n: number) {
  return `₱${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function NightAuditClient({ canManage }: { canManage: boolean }) {
  const [data, setData] = useState<Workbook | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [dialog, setDialog] = useState<"open" | "finalize" | null>(null);

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    else setLoading(true);
    const result = await apiFetch<Workbook>("/api/night-audit/summary");
    if (result.success) setData(result.data);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const status = data?.audit?.status ?? "NOT_STARTED";
  const searchLower = debouncedSearch.trim().toLowerCase();
  const rows = (data?.transactions ?? []).filter((t) => {
    if (!searchLower) return true;
    const guest = t.reservation ? formatGuestFullName(t.reservation.guest).toLowerCase() : "";
    return (
      t.transactionNo.toLowerCase().includes(searchLower) ||
      guest.includes(searchLower) ||
      (t.reservation?.reservationNo.toLowerCase().includes(searchLower) ?? false)
    );
  });

  const columns: ModuleColumn<TransactionRow>[] = [
    { key: "no", header: "Transaction #", render: (r) => <span className="font-medium text-blue-600">{r.transactionNo}</span> },
    { key: "guest", header: "Guest", render: (r) => (r.reservation ? formatGuestFullName(r.reservation.guest) : "—") },
    { key: "type", header: "Type", render: (r) => r.type },
    { key: "amount", header: "Amount", render: (r) => currency(Number(r.amount)) },
    { key: "cashier", header: "Cashier", render: (r) => `${r.user.firstName} ${r.user.lastName}` },
    { key: "time", header: "Time", render: (r) => new Date(r.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) },
  ];

  return (
    <>
      <FrontOfficeModuleLayout<TransactionRow>
        title="Night Audit"
        description="Daily transaction review, revenue summary, and audit finalization."
        breadcrumb={["Dashboard", "Operations", "Night Audit"]}
        onRefresh={() => load(true)}
        refreshing={refreshing}
        kpis={
          data
            ? [
                { label: "Audit Status", value: status.replace("_", " "), unit: "Today", icon: Moon, tone: "blue" },
                { label: "Transactions Reviewed", value: data.transactions.length, unit: "Today", icon: Receipt, tone: "purple" },
                { label: "Outstanding Balances", value: data.outstandingBalances.length, unit: "Guests with balance", icon: ReceiptText, tone: "amber" },
                { label: "Open Cashiers", value: data.openSessions.length, unit: "Must close before finalizing", icon: DoorOpen, tone: "green" },
              ]
            : []
        }
        quickActions={
          canManage
            ? [
                {
                  label: "Open Audit",
                  icon: Moon,
                  tone: "bg-blue-50 text-blue-700",
                  onClick: () => setDialog("open"),
                  disabled: !!data?.audit,
                },
                {
                  label: "Finalize Audit",
                  icon: ReceiptText,
                  tone: "bg-emerald-50 text-emerald-700",
                  onClick: () => setDialog("finalize"),
                  disabled: !data?.audit || status === "FINALIZED" || (data?.openSessions.length ?? 0) > 0,
                },
              ]
            : []
        }
        search={{ value: search, onChange: setSearch, placeholder: "Search transaction, guest, reservation…" }}
        filters={[]}
        onClearFilters={() => {}}
        tableTitle="Today's Transactions"
        columns={columns}
        rows={rows}
        loading={loading}
        meta={null}
        onPageChange={() => {}}
        emptyState={
          <ModuleEmptyState
            icon={Receipt}
            title="No transactions today"
            description="There are currently no cashiering transactions recorded for today's audit."
          />
        }
        activityTitle="Recent Activity"
        activityItems={(data?.activity ?? []).map((a) => ({
          id: a.id,
          time: new Date(a.time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
          label: a.label,
          icon: Moon,
          tone: "bg-blue-100 text-blue-600",
        }))}
      />

      {data ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <LogIn className="h-4 w-4" aria-hidden /> Today&apos;s Arrivals ({data.arrivals.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.arrivals.length === 0 ? (
                <p className="text-sm text-muted-foreground">No arrivals today.</p>
              ) : (
                data.arrivals.map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-sm">
                    <span>{formatGuestFullName(r.guest)}</span>
                    <span className="text-muted-foreground">Rm {r.room.number}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <LogOut className="h-4 w-4" aria-hidden /> Today&apos;s Departures ({data.departures.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.departures.length === 0 ? (
                <p className="text-sm text-muted-foreground">No departures today.</p>
              ) : (
                data.departures.map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-sm">
                    <span>{formatGuestFullName(r.guest)}</span>
                    <span className="text-muted-foreground">Rm {r.room.number}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BedDouble className="h-4 w-4" aria-hidden /> Room Occupancy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(data.roomStatus).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between text-sm">
                  <span>{status.replaceAll("_", " ")}</span>
                  <Badge variant="outline">{count}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {data.outstandingBalances.length > 0 ? (
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wallet className="h-4 w-4" aria-hidden /> Outstanding Balances
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.outstandingBalances.map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-sm">
                    <span>{r.guestName} — {r.reservationNo}</span>
                    <span className="font-medium text-amber-700">{currency(r.balance)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-base">Audit Status</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-3 text-sm">
              <NightAuditStatusBadge status={status} />
              {data.audit?.openedBy ? (
                <span className="text-muted-foreground">
                  Opened by {data.audit.openedBy.firstName} {data.audit.openedBy.lastName} at{" "}
                  {new Date(data.audit.openedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </span>
              ) : (
                <span className="text-muted-foreground">Today&apos;s audit has not been opened yet.</span>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      <NightAuditActionDialog
        open={dialog === "open"}
        onOpenChange={(o) => setDialog(o ? "open" : null)}
        onDone={() => load()}
        title="Open Night Audit"
        description="This opens tonight's audit and begins collecting today's transactions, arrivals, and departures for review."
        confirmLabel="Open Audit"
        endpoint="/api/night-audit/open"
        successMessage="Night audit opened."
      />
      <NightAuditActionDialog
        open={dialog === "finalize"}
        onOpenChange={(o) => setDialog(o ? "finalize" : null)}
        onDone={() => load()}
        title="Finalize Night Audit"
        description="This locks tonight's audit and records a permanent summary snapshot. This action cannot be undone."
        confirmLabel="Finalize Audit"
        endpoint="/api/night-audit/finalize"
        successMessage="Night audit finalized."
        variant="destructive"
      />
    </>
  );
}
