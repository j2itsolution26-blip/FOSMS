"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Receipt,
  Wallet,
  DoorOpen,
  DoorClosed,
  PlusCircle,
  Undo2,
  Lock,
  ReceiptText,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiFetch } from "@/lib/api-client";
import { FrontOfficeModuleLayout } from "@/components/modules/front-office-module-layout";
import { ModuleEmptyState } from "@/components/modules/module-empty-state";
import type { ModuleColumn } from "@/components/modules/types";

import { TransactionDialog } from "@/components/cashiering/transaction-dialog";
import { RefundDialog } from "@/components/cashiering/refund-dialog";
import { OpenCashierDialog } from "@/components/cashiering/open-cashier-dialog";
import { CloseCashierDialog } from "@/components/cashiering/close-cashier-dialog";

type TransactionRow = {
  id: string;
  transactionNo: string;
  type: "CHARGE" | "PAYMENT" | "REFUND" | "DISCOUNT";
  amount: string;
  paymentMethod: string | null;
  reversedById: string | null;
  createdAt: string;
  reservation: { reservationNo: string; guest: { firstName: string; lastName: string } } | null;
  user: { firstName: string; lastName: string };
};

type Summary = {
  kpis: { todaysTransactions: number; todaysRevenue: number; openCashiers: number; pendingPayments: number };
  transactions: TransactionRow[];
  activity: { id: string; time: string; action: string; label: string }[];
  mySessionOpen: boolean;
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

export function CashieringClient({ canManage }: { canManage: boolean }) {
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const debouncedSearch = useDebouncedValue(search);

  const [dialog, setDialog] = useState<"charge" | "payment" | "refund" | "open" | "close" | null>(null);

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
  const sessionOpen = summary?.mySessionOpen ?? false;

  const columns: ModuleColumn<TransactionRow>[] = [
    { key: "no", header: "Transaction #", render: (r) => <span className="font-medium text-blue-600">{r.transactionNo}</span> },
    { key: "guest", header: "Guest", render: (r) => (r.reservation ? `${r.reservation.guest.firstName} ${r.reservation.guest.lastName}` : "—") },
    { key: "reservation", header: "Reservation", render: (r) => r.reservation?.reservationNo ?? "—" },
    { key: "type", header: "Type", render: (r) => STATUS_META[r.type].label.replace("ed", "") },
    { key: "amount", header: "Amount", render: (r) => currency(Number(r.amount)) },
    { key: "method", header: "Payment Method", render: (r) => (r.paymentMethod ? r.paymentMethod.replaceAll("_", " ") : "—") },
    { key: "cashier", header: "Cashier", render: (r) => `${r.user.firstName} ${r.user.lastName}` },
    {
      key: "status",
      header: "Status",
      render: (r) => {
        const meta = r.reversedById ? STATUS_META.VOIDED : STATUS_META[r.type];
        return (
          <Badge variant="outline" className={meta.className}>
            {meta.label}
          </Badge>
        );
      },
    },
  ];

  return (
    <>
      <FrontOfficeModuleLayout<TransactionRow>
        title="Cashiering"
        description="Manage guest charges, payments, receipts, refunds, and cashier sessions."
        breadcrumb={["Dashboard", "Operations", "Cashiering"]}
        onRefresh={() => load(true)}
        refreshing={refreshing}
        kpis={
          summary
            ? [
                { label: "Today's Transactions", value: summary.kpis.todaysTransactions, unit: "Entries", icon: Receipt, tone: "blue" },
                { label: "Today's Revenue", value: currency(summary.kpis.todaysRevenue), unit: "Net of refunds", icon: Wallet, tone: "green" },
                { label: "Open Cashiers", value: summary.kpis.openCashiers, unit: "Active sessions", icon: DoorOpen, tone: "purple" },
                { label: "Pending Payments", value: summary.kpis.pendingPayments, unit: "Guests with balance", icon: ReceiptText, tone: "amber" },
              ]
            : []
        }
        quickActions={[
          ...(canManage
            ? [
                { label: "New Transaction", icon: PlusCircle, tone: "bg-blue-50 text-blue-700", onClick: () => setDialog("charge"), disabled: !sessionOpen },
                { label: "Receive Payment", icon: Wallet, tone: "bg-emerald-50 text-emerald-700", onClick: () => setDialog("payment"), disabled: !sessionOpen },
                { label: "Issue Refund", icon: Undo2, tone: "bg-red-50 text-red-700", onClick: () => setDialog("refund"), disabled: !sessionOpen },
                { label: "Open Cashier", icon: DoorOpen, tone: "bg-violet-50 text-violet-700", onClick: () => setDialog("open"), disabled: sessionOpen },
                { label: "Close Cashier", icon: DoorClosed, tone: "bg-slate-100 text-slate-700", onClick: () => setDialog("close"), disabled: !sessionOpen },
              ]
            : []),
          { label: "View Receipts", icon: Receipt, tone: "bg-amber-50 text-amber-700", onClick: () => router.push("/cashiering/receipts") },
        ]}
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
            actionLabel={canManage && sessionOpen ? "New Transaction" : undefined}
            onAction={canManage && sessionOpen ? () => setDialog("charge") : undefined}
          />
        }
        activityTitle="Recent Activity"
        activityItems={(summary?.activity ?? []).map((a) => ({
          id: a.id,
          time: new Date(a.time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
          label: a.label,
          icon: a.action === "CASHIER_OPENED" ? DoorOpen : a.action === "CASHIER_CLOSED" ? Lock : Wallet,
          tone: "bg-emerald-100 text-emerald-600",
        }))}
      />

      {!sessionOpen && canManage ? (
        <p className="mt-3 text-sm text-muted-foreground">
          You don&apos;t have an open cashier session — open one before recording transactions or refunds.
        </p>
      ) : null}

      <TransactionDialog open={dialog === "charge" || dialog === "payment"} onOpenChange={(o) => setDialog(o ? "charge" : null)} onDone={() => load()} defaultType={dialog === "payment" ? "PAYMENT" : "CHARGE"} />
      <RefundDialog open={dialog === "refund"} onOpenChange={(o) => setDialog(o ? "refund" : null)} onDone={() => load()} />
      <OpenCashierDialog open={dialog === "open"} onOpenChange={(o) => setDialog(o ? "open" : null)} onDone={() => load()} />
      <CloseCashierDialog open={dialog === "close"} onOpenChange={(o) => setDialog(o ? "close" : null)} onDone={() => load()} />
    </>
  );
}
