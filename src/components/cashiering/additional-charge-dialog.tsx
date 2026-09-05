"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/lib/api-client";

const ADDITIONAL_CHARGE_TYPE_OPTIONS = [
  { value: "DAMAGE", label: "Damage" },
  { value: "LOST_ITEM", label: "Lost Item" },
  { value: "ADDITIONAL_SERVICE", label: "Additional Service" },
  { value: "OTHER", label: "Other" },
] as const;

function currency(n: number) {
  return `₱${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Posts a manual CHARGE against the same reservation being checked out —
 * for guest damage, a lost item, an additional chargeable service, or
 * anything else the Front Desk Officer needs to bill before checkout. Goes
 * through the same POST /api/cashiering/transactions createTransaction()
 * path as every other Cashiering charge, so it immediately becomes part of
 * the reservation's real balance (reservationBalance()) — never a separate,
 * unlinked transaction.
 */
export function AdditionalChargeDialog({
  reservationId,
  guestName,
  open,
  onOpenChange,
  onDone,
}: {
  reservationId: string | null;
  guestName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [chargeType, setChargeType] = useState<(typeof ADDITIONAL_CHARGE_TYPE_OPTIONS)[number]["value"] | "">("");
  const [otherChargeType, setOtherChargeType] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setChargeType("");
      setOtherChargeType("");
      setDescription("");
      setAmount("");
    }
  }, [open]);

  const numericAmount = Number(amount);
  const amountError =
    amount.trim() === "" || Number.isNaN(numericAmount) ? null : numericAmount <= 0 ? "Amount must be greater than ₱0.00." : null;
  const canSubmit =
    !!reservationId &&
    !!chargeType &&
    (chargeType !== "OTHER" || !!otherChargeType.trim()) &&
    !!description.trim() &&
    amount.trim() !== "" &&
    !amountError &&
    numericAmount > 0;

  async function handleSubmit() {
    if (!reservationId || !chargeType) return;
    setBusy(true);
    const result = await apiFetch("/api/cashiering/transactions", {
      method: "POST",
      body: JSON.stringify({
        reservationId,
        type: "CHARGE",
        amount: numericAmount,
        reference: description.trim(),
        additionalChargeType: chargeType,
        otherChargeType: chargeType === "OTHER" ? otherChargeType.trim() : undefined,
      }),
    });
    setBusy(false);
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success("Additional charge added to the guest's folio.");
    onOpenChange(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Additional Charge</DialogTitle>
          <DialogDescription>
            {guestName
              ? `Record a damage, lost item, or additional charge for ${guestName}. It's added to this reservation's balance immediately.`
              : "Record a damage, lost item, or additional charge. It's added to this reservation's balance immediately."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>
              Type <span className="text-red-500">*</span>
            </Label>
            <Select value={chargeType} onValueChange={(v) => setChargeType(v as typeof chargeType)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a charge type" />
              </SelectTrigger>
              <SelectContent>
                {ADDITIONAL_CHARGE_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {chargeType === "OTHER" ? (
            <div className="space-y-1.5">
              <Label>
                Other Charge Type <span className="text-red-500">*</span>
              </Label>
              <Input placeholder="Enter charge type" value={otherChargeType} onChange={(e) => setOtherChargeType(e.target.value)} />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label>
              Description <span className="text-red-500">*</span>
            </Label>
            <Input placeholder="e.g. Broken Lamp" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>
              Amount <span className="text-red-500">*</span>
            </Label>
            <Input type="number" min={0.01} step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
            {amountError ? <p className="text-xs text-red-600">{amountError}</p> : null}
          </div>

          {chargeType && description.trim() && amount.trim() && !amountError ? (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>
                This adds <strong>{currency(numericAmount)}</strong> to the guest&apos;s outstanding balance. Checkout stays blocked
                until it&apos;s paid in Cashiering.
              </p>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit || busy}>
            {busy ? "Adding…" : "Add Charge"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
