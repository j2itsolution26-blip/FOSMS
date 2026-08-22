"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, Printer, Receipt as ReceiptIcon, Wallet, Undo2, ReceiptText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiFetch, type PaginationMeta } from "@/lib/api-client";
import { ModuleHeader } from "@/components/modules/module-header";
import { ModuleKpiGrid } from "@/components/modules/module-kpi-grid";
import { ModuleDataTable } from "@/components/modules/module-data-table";
import { ModuleEmptyState } from "@/components/modules/module-empty-state";
import type { ModuleColumn } from "@/components/modules/types";

type ReceiptRow = {
  id: string;
  receiptNumber: string;
  type: "PAYMENT" | "REFUND";
  status: "PAID" | "REFUNDED" | "REFUND_ISSUED";
  amount: string;
  paymentMethod: string | null;
  description: string | null;
  paymentDate: string;
  guestName: string | null;
  reservationNo: string | null;
  createdBy: string;
};

type Kpis = { totalReceipts: number; totalCollected: number; totalRefunded: number; netCollected: number };

const STATUS_META: Record<ReceiptRow["status"], { label: string; className: string }> = {
  PAID: { label: "Paid", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  REFUNDED: { label: "Refunded", className: "bg-red-100 text-red-800 border-red-200" },
  REFUND_ISSUED: { label: "Refund Issued", className: "bg-blue-100 text-blue-800 border-blue-200" },
};

function currency(n: number) {
  return `₱${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ReceiptsTable() {
  const [rows, setRows] = useState<ReceiptRow[]>([]);
  const [listMeta, setListMeta] = useState<PaginationMeta | null>(null);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);
  const requestIdRef = useRef(0);

  const load = useCallback(async (showSpinner = false) => {
    const requestId = ++requestIdRef.current;
    if (showSpinner) setRefreshing(true);
    else setLoading(true);
    setLoadError(null);

    const params = new URLSearchParams({ page: String(page), pageSize: "10" });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (statusFilter) params.set("status", statusFilter);
    if (methodFilter) params.set("paymentMethod", methodFilter);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

    const [listRes, kpiRes] = await Promise.all([
      apiFetch<ReceiptRow[]>(`/api/cashiering/receipts?${params.toString()}`),
      apiFetch<Kpis>("/api/cashiering/receipts/kpis"),
    ]);

    // A newer request was fired while this one was in flight (e.g. debounced
    // search after the initial mount fetch) — drop this stale response.
    if (requestId !== requestIdRef.current) return;

    if (listRes.success) {
      setRows(listRes.data);
      setListMeta(listRes.meta ?? null);
    } else if (listRes.code === "UNAUTHORIZED") {
      setLoadError("Your session has expired. Please log in again.");
    } else {
      setLoadError("Unable to load receipts. Please try again.");
    }
    if (kpiRes.success) setKpis(kpiRes.data);

    setLoading(false);
    setRefreshing(false);
  }, [page, debouncedSearch, statusFilter, methodFilter, dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  const hasActiveFilters = !!search || !!statusFilter || !!methodFilter || !!dateFrom || !!dateTo;

  const columns: ModuleColumn<ReceiptRow>[] = [
    {
      key: "no",
      header: "Receipt Number",
      render: (r) => (
        <a href={`/cashiering/receipts/${r.id}`} className="font-medium text-blue-600 hover:underline">
          {r.receiptNumber}
        </a>
      ),
    },
    { key: "guest", header: "Trainee / Guest", render: (r) => r.guestName ?? "—" },
    { key: "amount", header: "Amount", render: (r) => currency(Number(r.amount)) },
    { key: "method", header: "Payment Method", render: (r) => (r.paymentMethod ? r.paymentMethod.replaceAll("_", " ") : "—") },
    { key: "date", header: "Payment Date", render: (r) => new Date(r.paymentDate).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) },
    { key: "description", header: "Description / Purpose", render: (r) => r.description ?? "—" },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <Badge variant="outline" className={STATUS_META[r.status].className}>
          {STATUS_META[r.status].label}
        </Badge>
      ),
    },
    { key: "createdBy", header: "Created By", render: (r) => r.createdBy },
    {
      key: "actions",
      header: "Actions",
      render: (r) => (
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="icon" aria-label={`View receipt ${r.receiptNumber}`}>
            <a href={`/cashiering/receipts/${r.id}`}>
              <Eye className="h-4 w-4" />
            </a>
          </Button>
          <Button asChild variant="ghost" size="icon" aria-label={`Print receipt ${r.receiptNumber}`}>
            <a href={`/cashiering/receipts/${r.id}?print=1`}>
              <Printer className="h-4 w-4" />
            </a>
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Receipts"
        description="All payment and refund receipts recorded through Cashiering."
        breadcrumb={["Dashboard", "Operations", "Cashiering", "Receipts"]}
        onRefresh={() => load(true)}
        refreshing={refreshing}
      />

      <ModuleKpiGrid
        kpis={
          kpis
            ? [
                { label: "Total Receipts", value: kpis.totalReceipts, unit: "Payments & refunds", icon: ReceiptIcon, tone: "blue" },
                { label: "Total Collected", value: currency(kpis.totalCollected), unit: "All payments", icon: Wallet, tone: "green" },
                { label: "Total Refunded", value: currency(kpis.totalRefunded), unit: "All refunds", icon: Undo2, tone: "amber" },
                { label: "Net Collected", value: currency(kpis.netCollected), unit: "Collected minus refunded", icon: ReceiptText, tone: "purple" },
              ]
            : []
        }
      />

      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="w-full sm:w-64">
            <Input
              placeholder="Search receipt #, guest, reservation…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <select
            className="h-9 rounded-md border bg-white px-3 text-sm"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Status"
          >
            <option value="">All statuses</option>
            <option value="PAID">Paid</option>
            <option value="REFUNDED">Refunded</option>
            <option value="REFUND_ISSUED">Refund Issued</option>
          </select>
          <select
            className="h-9 rounded-md border bg-white px-3 text-sm"
            value={methodFilter}
            onChange={(e) => {
              setMethodFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Payment Method"
          >
            <option value="">All payment methods</option>
            <option value="CASH">Cash</option>
            <option value="CARD">Card</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="OTHER">Other</option>
          </select>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground" htmlFor="receipts-date-from">From</label>
            <Input
              id="receipts-date-from"
              type="date"
              className="w-40"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
            />
            <label className="text-sm text-muted-foreground" htmlFor="receipts-date-to">To</label>
            <Input
              id="receipts-date-to"
              type="date"
              className="w-40"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
            />
          </div>
          {hasActiveFilters ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setStatusFilter("");
                setMethodFilter("");
                setDateFrom("");
                setDateTo("");
                setPage(1);
              }}
            >
              Clear Filters
            </Button>
          ) : null}
        </div>

        {loadError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{loadError}</div>
        ) : loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <ModuleDataTable
            columns={columns}
            rows={rows}
            loading={false}
            meta={listMeta}
            onPageChange={setPage}
            emptyState={
              <ModuleEmptyState
                icon={ReceiptIcon}
                title="No receipts available."
                description="No payment or refund receipts match the current filters."
              />
            }
          />
        )}
      </div>
    </div>
  );
}
