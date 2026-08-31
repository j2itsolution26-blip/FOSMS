"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Receipt, Wallet, ReceiptText, Undo2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatGuestFullName } from "@/lib/formatters";
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

const DISCOUNT_LABELS: Record<NonNullable<TransactionRow["discountType"]>, string> = {
  SENIOR_CITIZEN: "Senior Citizen",
  PWD: "PWD",
  STAKEHOLDER: "Stakeholder",
};

type Summary = {
  kpis: { todaysTransactions: number; todaysRevenue: number; pendingPayments: number };
  transactions: TransactionRow[];
  awaitingPayment: GuestAwaitingPaymentRow[];
  activity: { id: string; time: string; action: string; label: string }[];
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  CHARGE: { label: "Charged", className: "bg-amber-100 text-amber-800 border-amber-200" },
  PAYMENT: { label: "Paid", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  DISCOUNT: { label: "Discounted", className: "bg-blue-100 text-blue-800 border-blue-200" },
  REFUND: { label: "Refunded", className: "bg-red-100 text-red-800 border-red-200" },
  VOIDED: { label: "Voided", className: "bg-slate-200 text-slate-800 border-slate-300" },
};

function currency(n: number) {
  return `₱${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

  // "Transact" on a specific row settles that exact charge in place (no new
  // visible transaction) — a different, narrower flow than the general
  // reservation-level Receive Payment used by GuestsAwaitingPayment below.
  function handleTransact(txn: TransactionRow) {
    setDetailsTxn(null);
    setSettleTxn(txn);
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
          className="font-medium text-blue-600 hover:underline"
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
    { key: "type", header: "Type", render: (r) => TRANSACTION_TYPE_LABELS[r.type] },
    { key: "amount", header: "Amount", className: "text-right tabular-nums", render: (r) => currency(Number(r.amount)) },
    { key: "method", header: "Payment Method", render: (r) => (r.paymentMethod ? r.paymentMethod.replaceAll("_", " ") : "—") },
    { key: "discount", header: "Discount Type", render: (r) => (r.discountType ? DISCOUNT_LABELS[r.discountType] : "—") },
    { key: "vat", header: "VAT", className: "text-right tabular-nums", render: (r) => (r.vatAmount ? currency(Number(r.vatAmount)) : "—") },
    { key: "cashier", header: "Processed By", render: (r) => `${r.user.firstName} ${r.user.lastName}` },
    {
      key: "status",
      header: "Status",
      render: (r) => {
        const meta = r.reversedById ? STATUS_META.VOIDED : isChargeFullyPaid(r) ? STATUS_META.PAYMENT : STATUS_META[r.type];
        return (
          <button type="button" onClick={() => setDetailsTxn(r)} aria-label={`${meta.label} — view transaction details`}>
            <Badge variant="outline" className={`${meta.className} cursor-pointer hover:opacity-80`}>
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
            onTransact={(reservationId) => openTransactionDialog("payment", reservationId)}
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
        columns={columns}
        rows={rows}
        loading={loading}
        meta={null}
        onPageChange={() => {}}
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
