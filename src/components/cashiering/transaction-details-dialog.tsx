"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatGuestFullName } from "@/lib/formatters";

export type TransactionDetailsRow = {
  id: string;
  transactionNo: string;
  type: "CHARGE" | "PAYMENT" | "REFUND" | "DISCOUNT";
  amount: string;
  paymentMethod: string | null;
  reversedById: string | null;
  createdAt: string;
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
};

const DISCOUNT_LABELS: Record<NonNullable<TransactionDetailsRow["discountType"]>, string> = {
  SENIOR_CITIZEN: "Senior Citizen",
  PWD: "PWD",
  STAKEHOLDER: "Stakeholder",
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

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
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
}: {
  transaction: TransactionDetailsRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canViewReservations: boolean;
  canViewGuests: boolean;
  canViewRooms: boolean;
}) {
  if (!transaction) return null;

  const statusMeta = transaction.reversedById ? STATUS_META.VOIDED : STATUS_META[transaction.type];
  const isReceiptEligible = transaction.type === "PAYMENT" || transaction.type === "REFUND";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-6">
            <DialogTitle>{transaction.transactionNo}</DialogTitle>
            <Badge variant="outline" className={statusMeta.className}>
              {statusMeta.label}
            </Badge>
          </div>
          <DialogDescription>
            {new Date(transaction.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Guest"
            value={
              transaction.reservation ? (
                canViewGuests ? (
                  <Link href={`/guests?guestId=${transaction.reservation.guestId}`} className="text-blue-600 hover:underline">
                    {formatGuestFullName(transaction.reservation.guest)}
                  </Link>
                ) : (
                  formatGuestFullName(transaction.reservation.guest)
                )
              ) : (
                "—"
              )
            }
          />
          <Field
            label="Reservation"
            value={
              transaction.reservation ? (
                canViewReservations ? (
                  <Link
                    href={`/reservations?reservationId=${transaction.reservation.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {transaction.reservation.reservationNo}
                  </Link>
                ) : (
                  transaction.reservation.reservationNo
                )
              ) : (
                "—"
              )
            }
          />
          <Field
            label="Room"
            value={
              transaction.reservation ? (
                canViewRooms ? (
                  <Link href={`/rooms?roomId=${transaction.reservation.roomId}`} className="text-blue-600 hover:underline">
                    {transaction.reservation.room.number}
                  </Link>
                ) : (
                  transaction.reservation.room.number
                )
              ) : (
                "—"
              )
            }
          />
          <Field label="Room Type" value={transaction.roomType?.name ?? transaction.reservation?.room.roomType.name ?? "—"} />
          <Field label="Type" value={STATUS_META[transaction.type].label.replace("ed", "")} />
          <Field label="Amount" value={currency(Number(transaction.amount))} />
          <Field label="Payment Method" value={transaction.paymentMethod ? transaction.paymentMethod.replaceAll("_", " ") : "—"} />
          <Field label="Discount Type" value={transaction.discountType ? DISCOUNT_LABELS[transaction.discountType] : "—"} />
          <Field label="VAT" value={transaction.vatAmount ? currency(Number(transaction.vatAmount)) : "—"} />
          <Field label="Processed By" value={`${transaction.user.firstName} ${transaction.user.lastName}`} />
        </div>

        {isReceiptEligible ? (
          <Link
            href={`/cashiering/receipts/${transaction.id}`}
            className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
          >
            View Receipt <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
