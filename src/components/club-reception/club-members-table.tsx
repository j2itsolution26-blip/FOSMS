"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Search, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { apiFetch, type PaginationMeta } from "@/lib/api-client";
import { formatGuestFullName, formatPaymentMethod } from "@/lib/formatters";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

type ClubMemberRow = {
  id: string;
  membershipNo: string;
  guest: { firstName: string; middleName: string | null; lastName: string };
  registeredBy: { firstName: string; lastName: string } | null;
  feeAmount: number;
  membershipDate: string;
  status: "ACTIVE" | "UNPAID";
  paymentMethod: string | null;
  otherPaymentMethod: string | null;
  amountPaid: number;
  transactionId: string | null;
};

function currency(n: number) {
  return `₱${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_BADGE: Record<ClubMemberRow["status"], string> = {
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  UNPAID: "border-amber-200 bg-amber-50 text-amber-700",
};

/**
 * The dedicated Club Members list — deliberately separate from the Guests
 * page and from Today's Club Reception. Registering a membership is a
 * membership-registration action, not a guest check-in, so a newly
 * registered member only ever shows up here until they separately go
 * through a real guest/stay/check-in workflow later.
 */
export function ClubMembersTable() {
  const [rows, setRows] = useState<ClubMemberRow[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "UNPAID">("ALL");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "10" });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (statusFilter !== "ALL") params.set("status", statusFilter);

    const result = await apiFetch<ClubMemberRow[]>(`/api/club-membership?${params.toString()}`);
    if (result.success) {
      setRows(result.data);
      setMeta(result.meta ?? null);
    }
    setLoading(false);
  }, [page, debouncedSearch, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-2.5 py-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Club Members</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Registered Club Members and their one-time membership payment — separate from guest check-ins.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm sm:flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-10 rounded-lg pl-10"
              placeholder="Search member name…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v as typeof statusFilter);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-10 w-[160px] rounded-lg" aria-label="Membership Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="UNPAID">Unpaid</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Table>
          <TableHeader className="sticky top-0 z-10 bg-slate-50/80 backdrop-blur-sm">
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-11 px-4 text-xs font-semibold tracking-wide text-slate-600 uppercase">Full Name</TableHead>
              <TableHead className="h-11 px-4 text-xs font-semibold tracking-wide text-slate-600 uppercase">Member ID</TableHead>
              <TableHead className="h-11 px-4 text-xs font-semibold tracking-wide text-slate-600 uppercase">Status</TableHead>
              <TableHead className="h-11 px-4 text-xs font-semibold tracking-wide text-slate-600 uppercase">Membership Date</TableHead>
              <TableHead className="h-11 px-4 text-xs font-semibold tracking-wide text-slate-600 uppercase">Payment</TableHead>
              <TableHead className="h-11 px-4 text-xs font-semibold tracking-wide text-slate-600 uppercase">Membership Fee</TableHead>
              <TableHead className="h-11 px-4 text-xs font-semibold tracking-wide text-slate-600 uppercase">Front Desk Officer</TableHead>
              <TableHead className="h-11 w-16 px-4 text-xs font-semibold tracking-wide text-slate-600 uppercase">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((__, j) => (
                    <TableCell key={j} className="px-4 py-3.5">
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={8} className="py-14 text-center text-sm text-muted-foreground">
                  No Club Members found.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="px-4 py-3.5 font-medium text-slate-900">{formatGuestFullName(m.guest)}</TableCell>
                  <TableCell className="px-4 py-3.5 font-mono text-xs text-slate-700">{m.membershipNo}</TableCell>
                  <TableCell className="px-4 py-3.5">
                    <Badge variant="outline" className={STATUS_BADGE[m.status]}>
                      {m.status === "ACTIVE" ? "Active" : "Unpaid"}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3.5 text-slate-700">
                    {new Date(m.membershipDate).toLocaleDateString("en-US", { dateStyle: "medium" })}
                  </TableCell>
                  <TableCell className="px-4 py-3.5 text-slate-700">
                    {m.status === "ACTIVE" ? (
                      <span>
                        {currency(m.amountPaid)} —{" "}
                        {formatPaymentMethod(m.paymentMethod, m.otherPaymentMethod) ?? "Paid"}
                      </span>
                    ) : (
                      "Not paid"
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3.5 text-slate-700">{currency(m.feeAmount)}</TableCell>
                  <TableCell className="px-4 py-3.5 text-slate-700">
                    {m.registeredBy ? `${m.registeredBy.firstName} ${m.registeredBy.lastName}` : "—"}
                  </TableCell>
                  <TableCell className="px-4 py-3.5">
                    {m.transactionId ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 rounded-full border-slate-200 text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                            aria-label="View membership receipt"
                            asChild
                          >
                            <Link href={`/cashiering/receipts/${m.transactionId}`}>
                              <FileText className="h-4 w-4" />
                            </Link>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>View Membership Receipt</TooltipContent>
                      </Tooltip>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {meta ? <PaginationBar meta={meta} onPageChange={setPage} /> : null}
    </div>
  );
}
