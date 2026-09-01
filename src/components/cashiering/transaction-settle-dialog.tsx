"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api-client";
import { formatGuestFullName } from "@/lib/formatters";
import type { TransactionDetailsRow } from "@/components/cashiering/transaction-details-dialog";

const DISCOUNT_LABELS: Record<NonNullable<TransactionDetailsRow["discountType"]>, string> = {
  SENIOR_CITIZEN: "Senior Citizen",
  PWD: "PWD",
  STAKEHOLDER: "Stakeholder",
};

function currency(n: number) {
  return `₱${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * "Transact" on an existing charge — settles it in place. This never lets
 * the cashier pick a different reservation, type, or payment method: it
 * always pays the exact transaction it was opened from, preserving every
 * field already on that row (guest, reservation, room, discount, VAT,
 * payment method) and only recording that it's been paid.
 */
export function TransactionSettleDialog({
  transaction,
  open,
  onOpenChange,
  onDone,
}: {
  transaction: TransactionDetailsRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [processedBy, setProcessedBy] = useState("");
  const [busy, setBusy] = useState(false);

  const originalAmount = transaction ? Number(transaction.amount) : 0;
  const remaining = transaction ? Math.max(0, Math.round((originalAmount - transaction.paidAmount) * 100) / 100) : 0;

  useEffect(() => {
    if (open && transaction) {
      setAmount(remaining > 0 ? String(remaining) : "");
      setReference("");
      setProcessedBy("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, transaction?.id]);

  if (!transaction) return null;

  const guestName = transaction.reservation ? formatGuestFullName(transaction.reservation.guest) : "—";
  const alreadyFullyPaid = remaining <= 0;
  const numericAmount = Number(amount);
  const amountError =
    !alreadyFullyPaid && amount.trim() !== "" && !Number.isNaN(numericAmount)
      ? numericAmount <= 0
        ? "Amount must be greater than ₱0.00."
        : numericAmount > remaining
          ? `Amount cannot exceed the remaining balance of ${currency(remaining)}.`
          : null
      : null;
  const canSubmit = !alreadyFullyPaid && amount.trim() !== "" && !amountError && numericAmount > 0 && !!processedBy.trim();

  async function handleSubmit() {
    setBusy(true);
    const result = await apiFetch(`/api/cashiering/transactions/${transaction!.id}/pay`, {
      method: "POST",
      body: JSON.stringify({ amount: numericAmount, reference: reference || undefined, processedBy: processedBy.trim() }),
    });
    setBusy(false);
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success(
      numericAmount >= remaining
        ? `${transaction!.transactionNo} marked as paid.`
        : "Partial payment recorded."
    );
    onOpenChange(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transact</DialogTitle>
          <DialogDescription>Settle this transaction. The transaction number and details stay the same.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 rounded-md bg-slate-50 p-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Transaction</p>
              <p className="font-medium text-slate-900">{transaction.transactionNo}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Guest</p>
              <p className="font-medium text-slate-900">{guestName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Reservation</p>
              <p className="font-medium text-slate-900">{transaction.reservation?.reservationNo ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Room</p>
              <p className="font-medium text-slate-900">
                {transaction.reservation?.room.number ?? "—"}
                {transaction.roomType?.name ?? transaction.reservation?.room.roomType.name
                  ? ` · ${transaction.roomType?.name ?? transaction.reservation?.room.roomType.name}`
                  : ""}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Discount Type</p>
              <p className="font-medium text-slate-900">
                {transaction.discountType ? DISCOUNT_LABELS[transaction.discountType] : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">VAT</p>
              <p className="font-medium text-slate-900">{transaction.vatAmount ? currency(Number(transaction.vatAmount)) : "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Payment Method</p>
              <p className="font-medium text-slate-900">{transaction.paymentMethod?.replaceAll("_", " ") ?? "—"}</p>
            </div>
            <div className="col-span-2 border-t pt-2">
              <p className="text-xs text-muted-foreground">Amount</p>
              <p className="text-lg font-bold text-slate-900">{currency(originalAmount)}</p>
              {transaction.paidAmount > 0 && !alreadyFullyPaid ? (
                <p className="text-xs text-muted-foreground">
                  {currency(transaction.paidAmount)} already paid · {currency(remaining)} remaining
                </p>
              ) : null}
            </div>
          </div>

          {alreadyFullyPaid ? (
            <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Transaction is already fully paid.
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label>Amount to Pay</Label>
                <Input type="number" min={0.01} max={remaining} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
                {amountError ? (
                  <p className="text-xs text-red-600">{amountError}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Remaining balance: {currency(remaining)}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Reference (optional)</Label>
                <Input placeholder="Optional reference or notes" value={reference} onChange={(e) => setReference(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="uppercase tracking-wider text-xs font-semibold text-slate-700">
                  Processed By <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="Enter name of person who processed this payment"
                  value={processedBy}
                  onChange={(e) => setProcessedBy(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {alreadyFullyPaid ? "Close" : "Cancel"}
          </Button>
          {!alreadyFullyPaid ? (
            <Button type="button" onClick={handleSubmit} disabled={busy || !canSubmit}>
              {busy ? "Processing…" : "Confirm Payment"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
