"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Printer, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Combobox, type ComboboxOption } from "@/components/shared/combobox";
import { apiFetch } from "@/lib/api-client";
import { formatGuestFullName } from "@/lib/formatters";

type GuestRow = { id: string; firstName: string; middleName?: string | null; lastName: string; email: string | null };

type FinancialHistory = {
  guest: { id: string; firstName: string; middleName: string | null; lastName: string };
  membership: {
    membershipNo: string;
    feeAmount: number;
    transaction: { id: string; transactionNo: string; amount: number; paymentMethod: string | null; otherPaymentMethod: string | null } | null;
  } | null;
  guestTransactions: Array<{
    id: string;
    transactionNo: string;
    type: "CHARGE" | "PAYMENT" | "REFUND" | "DISCOUNT";
    amount: number;
    reversedById: string | null;
    reservationNo: string | null;
  }>;
  breakdown: { combinedTotal: number; combinedPaid: number; balance: number };
};

function currency(n: number) {
  return `₱${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function PaidBadge() {
  return (
    <Badge variant="outline" className="border-emerald-200 bg-emerald-100 text-emerald-800">
      PAID
    </Badge>
  );
}

export function MemberFinancialHistoryDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [guestId, setGuestId] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<FinancialHistory | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setGuestId("");
    setHistory(null);
    setError(null);
    apiFetch<GuestRow[]>("/api/guests?pageSize=200").then((res) => {
      if (res.success) setGuests(res.data);
    });
  }, [open]);

  useEffect(() => {
    if (!guestId) {
      setHistory(null);
      return;
    }
    setLoading(true);
    setError(null);
    apiFetch<FinancialHistory>(`/api/club-membership/${guestId}`).then((res) => {
      setLoading(false);
      if (res.success) setHistory(res.data);
      else setError(res.message);
    });
  }, [guestId]);

  const guestOptions: ComboboxOption[] = guests.map((g) => ({
    value: g.id,
    label: formatGuestFullName(g),
    description: g.email ?? undefined,
  }));

  const guestPayments = (history?.guestTransactions ?? []).filter((t) => t.type === "PAYMENT" && !t.reversedById);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Financial History</DialogTitle>
          <DialogDescription>Look up a guest/member&rsquo;s Club Membership and Guest/Walk-In payment history.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Combobox
            options={guestOptions}
            value={guestId}
            onChange={setGuestId}
            placeholder="Search guest or member…"
            searchPlaceholder="Search by name…"
            emptyText="No guests found."
            ariaLabel="Guest / Member"
          />

          {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          {history ? (
            <div className="space-y-4">
              <p className="text-lg font-semibold text-slate-900">{formatGuestFullName(history.guest)}</p>

              <div className="space-y-2 rounded-md border p-3">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Membership</p>
                {history.membership ? (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{currency(history.membership.feeAmount)}</p>
                      <p className="text-xs text-muted-foreground">Membership ID: {history.membership.membershipNo}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <PaidBadge />
                      {history.membership.transaction ? (
                        <Button type="button" size="sm" variant="outline" asChild>
                          <Link href={`/cashiering/receipts/${history.membership.transaction.id}`}>
                            <FileText className="h-3.5 w-3.5" /> View Receipt
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Not a Club Member.</p>
                )}
              </div>

              <div className="space-y-2 rounded-md border p-3">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Guest / Walk-In</p>
                {guestPayments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No guest payments on record.</p>
                ) : (
                  guestPayments.map((t) => (
                    <div key={t.id} className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{currency(t.amount)}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.reservationNo ?? t.transactionNo}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <PaidBadge />
                        <Button type="button" size="sm" variant="outline" asChild>
                          <Link href={`/cashiering/receipts/${t.id}`}>
                            <FileText className="h-3.5 w-3.5" /> View Receipt
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex items-center justify-between border-t pt-3">
                <span className="text-sm font-semibold text-slate-700">Combined Total Paid</span>
                <span className="text-lg font-bold text-slate-900">{currency(history.breakdown.combinedPaid)}</span>
              </div>

              <Button type="button" className="w-full" asChild>
                <a href={`/club-reception/combined-receipt/${history.guest.id}?print=1`} target="_blank" rel="noopener noreferrer">
                  <Printer className="h-4 w-4" /> Print Combined Receipt
                </a>
              </Button>
            </div>
          ) : !loading && !error ? (
            <p className="flex items-center gap-2 py-6 text-center text-sm text-muted-foreground">
              <Search className="h-4 w-4" /> Search for a guest or member to view their financial history.
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
