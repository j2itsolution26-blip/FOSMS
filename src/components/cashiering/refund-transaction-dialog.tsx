"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/lib/api-client";
import { formatGuestFullName } from "@/lib/formatters";
import { getActiveSettlementId, type TransactionDetailsRow } from "@/components/cashiering/transaction-details-dialog";

// No existing refund-reason list is configured anywhere in the system (unlike
// discount types, which come from DiscountType) — these are the categories
// requested for this feature, stored as descriptive text on the refund's
// existing `reference` field rather than a new enum/column.
const REFUND_REASON_OPTIONS = [
  "Guest cancellation",
  "Overpayment",
  "Duplicate payment",
  "Billing correction",
  "Service issue",
  "Other",
];

function currency(n: number) {
  return `₱${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function RefundTransactionDialog({
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
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [processedBy, setProcessedBy] = useState("");
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [busy, setBusy] = useState(false);

  // A CHARGE settled via "Transact" has no visible PAYMENT row to refund —
  // the refund must target the real (hidden) payment that settled it.
  const refundTargetId = transaction && transaction.type !== "PAYMENT" ? getActiveSettlementId(transaction) : transaction?.id;
  const refundTargetAmount =
    transaction && transaction.type !== "PAYMENT"
      ? Number(transaction.settledBy.find((s) => s.id === refundTargetId)?.amount ?? transaction.amount)
      : Number(transaction?.amount ?? 0);

  useEffect(() => {
    if (open && transaction) {
      setAmount(String(refundTargetAmount));
      setReason("");
      setCustomReason("");
      setProcessedBy("");
      setStep("form");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, transaction]);

  if (!transaction) return null;

  const originalAmount = refundTargetAmount;
  const numericAmount = Number(amount);
  const amountError =
    amount.trim() === "" || Number.isNaN(numericAmount)
      ? null
      : numericAmount <= 0
        ? "Refund amount must be greater than ₱0.00."
        : numericAmount > originalAmount
          ? `Refund amount cannot exceed the original amount of ${currency(originalAmount)}.`
          : null;
  const reasonValue = reason === "Other" ? customReason.trim() : reason;
  const canContinue =
    amount.trim() !== "" && !amountError && numericAmount > 0 && !!reasonValue && !!refundTargetId && !!processedBy.trim();
  const guestName = transaction.reservation ? formatGuestFullName(transaction.reservation.guest) : "—";

  async function handleConfirm() {
    if (!refundTargetId) return;
    setBusy(true);
    const result = await apiFetch("/api/cashiering/refund", {
      method: "POST",
      body: JSON.stringify({
        originalTransactionId: refundTargetId,
        amount: numericAmount,
        reference: reasonValue,
        processedBy: processedBy.trim(),
      }),
    });
    setBusy(false);
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success("Refund processed.");
    onOpenChange(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{step === "form" ? "Refund Transaction" : "Confirm Refund"}</DialogTitle>
          <DialogDescription>
            {step === "form"
              ? "Refunds create a linked reversal transaction — the original payment is never deleted."
              : "This processes a real refund against the guest's folio and cannot be undone from here."}
          </DialogDescription>
        </DialogHeader>

        {step === "form" ? (
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
                <p className="text-xs text-muted-foreground">Payment Method</p>
                <p className="font-medium text-slate-900">{transaction.paymentMethod?.replaceAll("_", " ") ?? "—"}</p>
              </div>
              <div className="col-span-2 border-t pt-2">
                <p className="text-xs text-muted-foreground">Original Amount</p>
                <p className="text-lg font-bold text-slate-900">{currency(originalAmount)}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Refund Amount</Label>
              <Input type="number" min={0.01} max={originalAmount} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
              {amountError ? (
                <p className="text-xs text-red-600">{amountError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">Maximum refundable: {currency(originalAmount)}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Refund Reason</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  {REFUND_REASON_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {reason === "Other" ? (
                <Textarea
                  rows={2}
                  placeholder="Enter the reason for this refund"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                />
              ) : null}
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
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Are you sure you want to refund <strong>{currency(numericAmount)}</strong> for <strong>{transaction.transactionNo}</strong>?
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 rounded-md bg-slate-50 p-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Refund Amount</p>
                <p className="font-bold text-slate-900">{currency(numericAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Guest</p>
                <p className="font-medium text-slate-900">{guestName}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Reason</p>
                <p className="font-medium text-slate-900">{reasonValue}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Processed By</p>
                <p className="font-medium text-slate-900">{processedBy.trim()}</p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "form" ? (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={() => setStep("confirm")} disabled={!canContinue}>
                Process Refund
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => setStep("form")} disabled={busy}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" onClick={handleConfirm} disabled={busy}>
                {busy ? "Processing…" : "Confirm Refund"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
