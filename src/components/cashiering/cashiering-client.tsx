"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Receipt, Wallet, ReceiptText, Undo2, CheckCircle2, Clock3, UserRound, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatDiscountType, formatGuestFullName, formatPaymentMethod } from "@/lib/formatters";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiFetch } from "@/lib/api-client";
import { FrontOfficeModuleLayout } from "@/components/modules/front-office-module-layout";
import { ModuleEmptyState } from "@/components/modules/module-empty-state";
import type { ModuleColumn } from "@/components/modules/types";

import { TransactionDialog } from "@/components/cashiering/transaction-dialog";
import { RefundTransactionDialog } from "@/components/cashiering/refund-transaction-dialog";
import { TransactionActionsMenu } from "@/components/cashiering/transaction-actions-menu";
import { GuestsAwaitingPayment, type GuestAwaitingPaymentRow } from "@/components/cashiering/guests-awaiting-payment";
import { TransactionSettleDialog } from "@/components/cashiering/transaction-settle-dialog";
import {
  TransactionDetailsDialog,
  TRANSACTION_TYPE_LABELS,
  isChargeFullyPaid,
  type TransactionDetailsRow,
} from "@/components/cashiering/transaction-details-dialog";

type TransactionRow = TransactionDetailsRow;

type Summary = {
  kpis: { todaysTransactions: number; todaysRevenue: number; pendingPayments: number };
  transactions: TransactionRow[];
  awaitingPayment: GuestAwaitingPaymentRow[];
  activity: { id: string; time: string; action: string; label: string }[];
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  CHARGE: { label: "Unpaid", className: "bg-amber-100 text-amber-800 border-amber-200" },
  PAYMENT: { label: "Paid", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  DISCOUNT: { label: "Discounted", className: "bg-blue-100 text-blue-800 border-blue-200" },
  REFUND: { label: "Refunded", className: "bg-red-100 text-red-800 border-red-200" },
  VOIDED: { label: "Voided", className: "bg-slate-200 text-slate-800 border-slate-300" },
};

function currency(n: number) {
  return `₱${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// The single source of truth for a row's effective status (reversed voids
// win, then a CHARGE fully settled via "Transact" reads as Paid) — used by
// both the Status column's badge and the summary strip's counts, so they can
// never disagree about what "Paid"/"Pending" means for a given row.
function resolveStatusMeta(r: TransactionRow) {
  return r.reversedById ? STATUS_META.VOIDED : isChargeFullyPaid(r) ? STATUS_META.PAYMENT : STATUS_META[r.type];
}

/** Compact, informational-only counts derived from the transactions already
 * loaded/filtered below the heading — additive to (never a replacement for)
 * the existing KPI cards and table rows. */
function TransactionSummaryStrip({ rows, totalCollected }: { rows: TransactionRow[]; totalCollected: number }) {
  const paid = rows.filter((r) => resolveStatusMeta(r).label === "Paid").length;
  const pending = rows.filter((r) => resolveStatusMeta(r).label === "Unpaid").length;

  const stats: { label: string; value: string; icon: typeof Receipt }[] = [
    { label: "Total Transactions", value: String(rows.length), icon: Receipt },
    { label: "Paid", value: String(paid), icon: CheckCircle2 },
    { label: "Pending", value: String(pending), icon: Clock3 },
    { label: "Total Collected", value: currency(totalCollected), icon: Wallet },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {stats.map((s) => (
        <div
          key={s.label}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-1.5"
        >
          <s.icon className="h-3.5 w-3.5 text-slate-400" aria-hidden />
          <span className="text-xs font-medium text-slate-500">{s.label}</span>
          <span className="text-sm font-semibold tabular-nums text-slate-900">{s.value}</span>
        </div>
      ))}
    </div>
  );
}

export function CashieringClient({
  canManage,
  canViewReservations,
  canViewGuests,
  canViewRooms,
}: {
  canManage: boolean;
  canViewReservations: boolean;
  canViewGuests: boolean;
  canViewRooms: boolean;
}) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const debouncedSearch = useDebouncedValue(search);

  const [dialog, setDialog] = useState<"charge" | "payment" | null>(null);
  const [detailsTxn, setDetailsTxn] = useState<TransactionRow | null>(null);
  const [refundTxn, setRefundTxn] = useState<TransactionRow | null>(null);
  const [settleTxn, setSettleTxn] = useState<TransactionRow | null>(null);
  const [transactReservationId, setTransactReservationId] = useState<string | undefined>(undefined);

  function openTransactionDialog(type: "charge" | "payment", reservationId?: string) {
    setTransactReservationId(reservationId);
    setDialog(type);
  }

  // "Transact" always settles a specific existing CHARGE in place (no new
  // visible transaction) — whether triggered from a transaction row or from
  // Guests Awaiting Payment below, which resolves to the same underlying
  // unpaid charge server-side.
  function handleTransact(txn: TransactionRow) {
    setDetailsTxn(null);
    setSettleTxn(txn);
  }

  function handleTransactFromAwaitingPayment(row: GuestAwaitingPaymentRow) {
    if (row.charge) {
      handleTransact(row.charge);
    } else {
      // No resolvable charge to settle in place (shouldn't normally happen
      // while a balance is owed) — fall back to a reservation-level payment.
      openTransactionDialog("payment", row.id);
    }
  }

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    else setLoading(true);
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    const result = await apiFetch<Summary>(`/api/cashiering/summary?${params.toString()}`);
    if (result.success) setSummary(result.data);
    setLoading(false);
    setRefreshing(false);
  }, [debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = (summary?.transactions ?? []).filter((t) => !typeFilter || t.type === typeFilter);

  const columns: ModuleColumn<TransactionRow>[] = [
    {
      key: "no",
      header: "Transaction #",
      render: (r) => (
        <button
          type="button"
          className="font-medium text-blue-600 transition-colors hover:text-blue-700 hover:underline"
          onClick={() => setDetailsTxn(r)}
        >
          {r.transactionNo}
        </button>
      ),
    },
    {
      key: "guest",
      header: "Guest",
      render: (r) =>
        r.reservation ? (
          canViewGuests ? (
            <Link href={`/guests?guestId=${r.reservation.guestId}`} className="hover:text-blue-600 hover:underline">
              {formatGuestFullName(r.reservation.guest)}
            </Link>
          ) : (
            formatGuestFullName(r.reservation.guest)
          )
        ) : r.clubMembership ? (
          formatGuestFullName(r.clubMembership.guest)
        ) : (
          "—"
        ),
    },
    {
      key: "reservation",
      header: "Reservation",
      render: (r) =>
        r.reservation ? (
          canViewReservations ? (
            <Link href={`/reservations?reservationId=${r.reservation.id}`} className="hover:text-blue-600 hover:underline">
              {r.reservation.reservationNo}
            </Link>
          ) : (
            r.reservation.reservationNo
          )
        ) : r.clubMembership ? (
          `Membership · ${r.clubMembership.membershipNo}`
        ) : (
          "—"
        ),
    },
    {
      key: "room",
      header: "Room",
      render: (r) =>
        r.reservation ? (
          canViewRooms ? (
            <Link href={`/rooms?roomId=${r.reservation.roomId}`} className="hover:text-blue-600 hover:underline">
              {r.reservation.room.number}
            </Link>
          ) : (
            r.reservation.room.number
          )
        ) : (
          "—"
        ),
    },
    { key: "roomType", header: "Room Type", render: (r) => r.roomType?.name ?? r.reservation?.room?.roomType.name ?? "—" },
    {
      key: "type",
      header: "Type",
      render: (r) => (
        <span className="flex items-center gap-1.5">
          {TRANSACTION_TYPE_LABELS[r.type]}
          {r.clubMembership ? (
            <Badge variant="outline" className="gap-1 border-violet-200 bg-violet-50 text-violet-700">
              <Users className="h-3 w-3" aria-hidden /> Membership
            </Badge>
          ) : null}
        </span>
      ),
    },
    { key: "amount", header: "Amount", className: "text-right tabular-nums", render: (r) => currency(Number(r.amount)) },
    { key: "method", header: "Payment Method", render: (r) => formatPaymentMethod(r.paymentMethod, r.otherPaymentMethod) ?? "Not recorded" },
    {
      key: "discount",
      header: "Discount Type",
      render: (r) => {
        const label = formatDiscountType(r.discountType, r.otherDiscountType);
        return label ? (
          <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
            {label}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
    {
      key: "discountAmount",
      header: "Discount Amount",
      className: "text-right tabular-nums",
      render: (r) => (r.discountAmount ? currency(Number(r.discountAmount)) : "—"),
    },
    { key: "vat", header: "VAT", className: "text-right tabular-nums", render: (r) => (r.vatAmount ? currency(Number(r.vatAmount)) : "—") },
    {
      key: "cashier",
      header: "Front Desk Officer",
      render: (r) => (
        <span className="flex items-center gap-1.5">
          <UserRound className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
          {r.processedBy || "Not recorded"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => {
        const meta = resolveStatusMeta(r);
        return (
          <button type="button" onClick={() => setDetailsTxn(r)} aria-label={`${meta.label} — view transaction details`}>
            <Badge variant="outline" className={`${meta.className} cursor-pointer px-2.5 py-0.5 font-medium hover:opacity-80`}>
              {meta.label}
            </Badge>
          </button>
        );
      },
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (r) => (
        <div className="flex justify-end">
          <TransactionActionsMenu
            transaction={r}
            canViewReservations={canViewReservations}
            canViewGuests={canViewGuests}
            canViewRooms={canViewRooms}
            canTransact={canManage}
            canRefund={canManage}
            onViewTransaction={() => setDetailsTxn(r)}
            onTransact={() => handleTransact(r)}
            onRefund={() => setRefundTxn(r)}
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <FrontOfficeModuleLayout<TransactionRow>
        title="Cashiering"
        description="Manage guest charges, payments, receipts, and refunds."
        breadcrumb={["Dashboard", "Operations", "Cashiering"]}
        onRefresh={() => load(true)}
        refreshing={refreshing}
        kpis={
          summary
            ? [
                { label: "Today's Transactions", value: summary.kpis.todaysTransactions, unit: "Entries", icon: Receipt, tone: "blue" },
                { label: "Today's Revenue", value: currency(summary.kpis.todaysRevenue), unit: "Net of refunds", icon: Wallet, tone: "green" },
                { label: "Pending Payments", value: summary.kpis.pendingPayments, unit: "Guests with balance", icon: ReceiptText, tone: "amber" },
              ]
            : []
        }
        quickActions={[]}
        secondarySection={
          <GuestsAwaitingPayment
            rows={summary?.awaitingPayment ?? []}
            canViewGuests={canViewGuests}
            canViewReservations={canViewReservations}
            canViewRooms={canViewRooms}
            canTransact={canManage}
            onTransact={handleTransactFromAwaitingPayment}
          />
        }
        search={{ value: search, onChange: setSearch, placeholder: "Search transaction, guest, receipt…" }}
        filters={[
          {
            label: "Type",
            value: typeFilter,
            placeholder: "All types",
            onChange: setTypeFilter,
            options: [
              { value: "CHARGE", label: "Charge" },
              { value: "PAYMENT", label: "Payment" },
              { value: "DISCOUNT", label: "Discount" },
              { value: "REFUND", label: "Refund" },
            ],
          },
        ]}
        onClearFilters={() => setTypeFilter("")}
        tableTitle="Today's Transactions"
        tableTitleExtra={
          summary ? <TransactionSummaryStrip rows={rows} totalCollected={summary.kpis.todaysRevenue} /> : null
        }
        tableVariant="modern"
        columns={columns}
        rows={rows}
        loading={loading}
        meta={null}
        onPageChange={() => {}}
        stickyHorizontalScroll
        emptyState={
          <ModuleEmptyState
            icon={Receipt}
            title="No transactions today"
            description="There are currently no cashiering transactions for the selected period."
          />
        }
        activityTitle="Recent Activity"
        activityItems={(summary?.activity ?? []).map((a) => ({
          id: a.id,
          time: new Date(a.time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
          label: a.label,
          icon: a.action === "REFUND_CREATED" ? Undo2 : Wallet,
          tone: "bg-emerald-100 text-emerald-600",
        }))}
      />

      <TransactionDialog
        open={dialog === "charge" || dialog === "payment"}
        onOpenChange={(o) => {
          setDialog(o ? "charge" : null);
          if (!o) setTransactReservationId(undefined);
        }}
        onDone={() => load()}
        defaultType={dialog === "payment" ? "PAYMENT" : "CHARGE"}
        initialReservationId={transactReservationId}
      />
      <RefundTransactionDialog
        transaction={refundTxn}
        open={!!refundTxn}
        onOpenChange={(o) => !o && setRefundTxn(null)}
        onDone={() => load()}
      />
      <TransactionSettleDialog
        transaction={settleTxn}
        open={!!settleTxn}
        onOpenChange={(o) => !o && setSettleTxn(null)}
        onDone={() => load()}
      />
      <TransactionDetailsDialog
        transaction={detailsTxn}
        open={!!detailsTxn}
        onOpenChange={(o) => !o && setDetailsTxn(null)}
        canViewReservations={canViewReservations}
        canViewGuests={canViewGuests}
        canViewRooms={canViewRooms}
        canTransact={canManage}
        onTransact={() => detailsTxn && handleTransact(detailsTxn)}
      />
    </>
  );
}
