"use client";

import Link from "next/link";
import { CheckCircle2, Circle, FileText, Printer, Repeat } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatGuestFullName } from "@/lib/formatters";

export type TransactionDetailsRow = {
  id: string;
  transactionNo: string;
  type: "CHARGE" | "PAYMENT" | "REFUND" | "DISCOUNT";
  amount: string;
  paymentMethod: string | null;
  reversedById: string | null;
  createdAt: string;
  /** Sum of non-reversed payments that settle this row via "Transact" (0 for
   * everything except a CHARGE that has been paid in place). */
  paidAmount: number;
  /** The internal payment(s) that settled this CHARGE via "Transact" — hidden
   * from the main table but needed to resolve what Refund should target. */
  settledBy: Array<{ id: string; amount: string; reversedById: string | null; createdAt: string }>;
  reservation: {
    id: string;
    reservationNo: string;
    guestId: string;
    roomId: string;
    guest: { firstName: string; middleName?: string | null; lastName: string };
    room: { number: string; roomType: { name: string } };
  } | null;
  user: { firstName: string; lastName: string };
  roomType: { name: string } | null;
  discountType: "SENIOR_CITIZEN" | "PWD" | "STAKEHOLDER" | null;
  vatAmount: string | null;
  /** The Cashiering transaction's own manually-typed processor — independent
   * of `user` (the logged-in account) and of the Guest Folio's processedBy. */
  processedBy: string | null;
};

const DISCOUNT_LABELS: Record<NonNullable<TransactionDetailsRow["discountType"]>, string> = {
  SENIOR_CITIZEN: "Senior Citizen",
  PWD: "PWD",
  STAKEHOLDER: "Stakeholder",
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  CHARGE: { label: "Unpaid", className: "bg-amber-100 text-amber-800 border-amber-200" },
  PAYMENT: { label: "Paid", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  DISCOUNT: { label: "Discounted", className: "bg-blue-100 text-blue-800 border-blue-200" },
  REFUND: { label: "Refunded", className: "bg-red-100 text-red-800 border-red-200" },
  VOIDED: { label: "Voided", className: "bg-slate-200 text-slate-800 border-slate-300" },
};

export const TRANSACTION_TYPE_LABELS: Record<TransactionDetailsRow["type"], string> = {
  CHARGE: "Charge",
  PAYMENT: "Payment",
  DISCOUNT: "Discount",
  REFUND: "Refund",
};

/** A CHARGE settled in place via "Transact" — paidAmount covers the full amount. */
export function isChargeFullyPaid(t: Pick<TransactionDetailsRow, "type" | "amount" | "paidAmount">): boolean {
  return t.type === "CHARGE" && t.paidAmount >= Number(t.amount);
}

/**
 * The real PAYMENT row to refund against for a CHARGE settled via "Transact"
 * — that internal payment is what actually moved money, even though it's
 * hidden from the table. Picks the most recent non-reversed settlement (the
 * same "most recent wins" convention used for discount backfill above);
 * refunding one payment at a time already matches how Refund works
 * everywhere else in the app.
 */
export function getActiveSettlementId(t: Pick<TransactionDetailsRow, "settledBy">): string | null {
  const active = t.settledBy
    .filter((s) => !s.reversedById)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return active[0]?.id ?? null;
}

/**
 * The single source of truth for "is this transaction a completed payment?" —
 * derived from the real type/reversedById columns (the same data the status
 * badge already uses), never a separate flag. A PAYMENT that was later
 * refunded no longer counts as completed, so Transact becomes available
 * again instead of permanently blocking further transactions on the folio.
 * A CHARGE fully settled via Transact counts too — it stays type CHARGE
 * forever, so completeness can't be read off `type` alone here.
 */
export function isCompletedPayment(
  t: Pick<TransactionDetailsRow, "type" | "reversedById" | "amount" | "paidAmount">
): boolean {
  return (t.type === "PAYMENT" && !t.reversedById) || isChargeFullyPaid(t);
}

function paymentStatusMessage(t: TransactionDetailsRow): { icon: typeof CheckCircle2; text: string; className: string } {
  if (isCompletedPayment(t)) {
    return { icon: CheckCircle2, text: "Payment completed", className: "text-emerald-700" };
  }
  if (t.type === "PAYMENT" && t.reversedById) {
    return { icon: Circle, text: "Payment voided — refunded", className: "text-slate-600" };
  }
  if (t.type === "REFUND") {
    return { icon: Circle, text: "Refund issued", className: "text-red-600" };
  }
  if (t.type === "DISCOUNT") {
    return { icon: Circle, text: "Discount applied to the folio", className: "text-blue-600" };
  }
  if (t.paidAmount > 0) {
    return { icon: Circle, text: "Charge — partially paid", className: "text-amber-600" };
  }
  return { icon: Circle, text: "Charge — outstanding transaction", className: "text-amber-600" };
}

function currency(n: number) {
  return `₱${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{children}</h3>;
}

/**
 * "View Transaction" destination for every transaction type. Receipts
 * (/cashiering/receipts/[id]) already cover PAYMENT/REFUND in full — this
 * dialog exists because CHARGE/DISCOUNT rows have no receipt at all, and
 * gives every row the same, consistent "view details" entry point using
 * data the table already has in hand (no extra fetch, no new route).
 */
export function TransactionDetailsDialog({
  transaction,
  open,
  onOpenChange,
  canViewReservations,
  canViewGuests,
  canViewRooms,
  canTransact,
  onTransact,
}: {
  transaction: TransactionDetailsRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canViewReservations: boolean;
  canViewGuests: boolean;
  canViewRooms: boolean;
  canTransact: boolean;
  onTransact: () => void;
}) {
  if (!transaction) return null;

  const statusMeta = transaction.reversedById
    ? STATUS_META.VOIDED
    : isChargeFullyPaid(transaction)
      ? STATUS_META.PAYMENT
      : STATUS_META[transaction.type];
  const isReceiptEligible = transaction.type === "PAYMENT" || transaction.type === "REFUND" || isChargeFullyPaid(transaction);
  const reservation = transaction.reservation;
  const canShowTransact = canTransact && !!reservation && !isCompletedPayment(transaction);
  const status = paymentStatusMessage(transaction);
  const StatusIcon = status.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3 pr-6">
            <DialogTitle>Transaction Details</DialogTitle>
            <Badge variant="outline" className={`shrink-0 ${statusMeta.className}`}>
              {statusMeta.label}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-3 border-t pt-4">
            <SectionHeading>Guest &amp; Reservation</SectionHeading>
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Guest"
                value={
                  reservation ? (
                    canViewGuests ? (
                      <Link href={`/guests?guestId=${reservation.guestId}`} className="text-blue-600 hover:underline">
                        {formatGuestFullName(reservation.guest)}
                      </Link>
                    ) : (
                      formatGuestFullName(reservation.guest)
                    )
                  ) : (
                    "—"
                  )
                }
              />
              <Field
                label="Reservation"
                value={
                  reservation ? (
                    canViewReservations ? (
                      <Link href={`/reservations?reservationId=${reservation.id}`} className="text-blue-600 hover:underline">
                        {reservation.reservationNo}
                      </Link>
                    ) : (
                      reservation.reservationNo
                    )
                  ) : (
                    "—"
                  )
                }
              />
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <SectionHeading>Room Information</SectionHeading>
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Room"
                value={
                  reservation ? (
                    canViewRooms ? (
                      <Link href={`/rooms?roomId=${reservation.roomId}`} className="text-blue-600 hover:underline">
                        {reservation.room.number}
                      </Link>
                    ) : (
                      reservation.room.number
                    )
                  ) : (
                    "—"
                  )
                }
              />
              <Field label="Room Type" value={transaction.roomType?.name ?? reservation?.room.roomType.name ?? "—"} />
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <SectionHeading>Payment Information</SectionHeading>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Transaction Type" value={TRANSACTION_TYPE_LABELS[transaction.type]} />
              <Field label="Payment Method" value={transaction.paymentMethod ? transaction.paymentMethod.replaceAll("_", " ") : "—"} />
            </div>
            <div className="rounded-md bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Total Amount</p>
              <p className="text-2xl font-bold text-slate-900">{currency(Number(transaction.amount))}</p>
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <SectionHeading>Discount &amp; Tax</SectionHeading>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Discount Type" value={transaction.discountType ? DISCOUNT_LABELS[transaction.discountType] : "—"} />
              <Field label="VAT" value={transaction.vatAmount ? currency(Number(transaction.vatAmount)) : "—"} />
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <SectionHeading>Processed By</SectionHeading>
            <p className="text-sm font-medium text-slate-900">{transaction.processedBy || "Not recorded"}</p>
          </div>

          <div className="space-y-3 border-t pt-4">
            <SectionHeading>Transaction Information</SectionHeading>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Transaction Number" value={transaction.transactionNo} />
              <Field
                label="Date / Time"
                value={new Date(transaction.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Payment Status</p>
              <p className={`flex items-center gap-1.5 text-sm font-medium ${status.className}`}>
                <StatusIcon className="h-3.5 w-3.5" /> {status.text}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-wrap gap-2 border-t pt-4 sm:justify-between">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <div className="flex flex-wrap gap-2">
            {isReceiptEligible ? (
              <Button type="button" variant="outline" asChild>
                <Link href={`/cashiering/receipts/${transaction.id}`}>
                  <FileText className="h-4 w-4" /> View Receipt
                </Link>
              </Button>
            ) : null}
            {isReceiptEligible ? (
              <Button type="button" variant="outline" asChild>
                <a href={`/cashiering/receipts/${transaction.id}?print=1`} target="_blank" rel="noopener noreferrer">
                  <Printer className="h-4 w-4" /> Print Receipt
                </a>
              </Button>
            ) : null}
            {canShowTransact ? (
              <Button type="button" onClick={onTransact}>
                <Repeat className="h-4 w-4" /> Transact
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
