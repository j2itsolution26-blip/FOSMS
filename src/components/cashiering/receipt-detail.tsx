"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export type ReceiptDetailData = {
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
  refundOfReceiptNumber: string | null;
  refundedByReceiptNumber: string | null;
  refundedAt: string | null;
  // Folio pricing breakdown — null for a plain (non-room) transaction.
  roomNumber: string | null;
  roomTypeName: string | null;
  isSmoking: boolean | null;
  subtotal: string | null;
  bedCount: number | null;
  bedCharge: string | null;
  discountType: "SENIOR_CITIZEN" | "PWD" | "STAKEHOLDER" | null;
  discountAmount: string | null;
  vatAmount: string | null;
};

const STATUS_META: Record<ReceiptDetailData["status"], { label: string; className: string }> = {
  PAID: { label: "Paid", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  REFUNDED: { label: "Refunded", className: "bg-red-100 text-red-800 border-red-200" },
  REFUND_ISSUED: { label: "Refund Issued", className: "bg-blue-100 text-blue-800 border-blue-200" },
};

const DISCOUNT_LABELS: Record<NonNullable<ReceiptDetailData["discountType"]>, string> = {
  SENIOR_CITIZEN: "Senior Citizen",
  PWD: "PWD",
  STAKEHOLDER: "Stakeholder",
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

function LineItem({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between text-sm ${muted ? "text-muted-foreground" : "text-slate-800"}`}>
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

export function ReceiptDetail({ receipt, orgName }: { receipt: ReceiptDetailData; orgName: string }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("print") === "1") {
      window.print();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusMeta = STATUS_META[receipt.status];
  const hasFolioBreakdown = receipt.subtotal !== null;
  const amountPaid = Number(receipt.amount);
  const bedCharge = receipt.bedCharge ? Number(receipt.bedCharge) : 0;
  const roomPrice = hasFolioBreakdown ? Number(receipt.subtotal) - bedCharge : 0;
  const vatAmount = Number(receipt.vatAmount ?? 0);
  const discountAmount = receipt.discountAmount ? Number(receipt.discountAmount) : 0;
  // The itemized total reflects the full folio charge, independent of how
  // much of it this particular payment covers — a partial payment shows its
  // own "Amount Paid" plus a remaining balance below, not a shrunken total.
  const folioTotal = hasFolioBreakdown ? Number(receipt.subtotal) - discountAmount + vatAmount : amountPaid;
  const balance = hasFolioBreakdown ? Math.max(0, Math.round((folioTotal - amountPaid) * 100) / 100) : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link href="/cashiering/receipts">
            <ArrowLeft className="h-4 w-4" /> Back to Receipts
          </Link>
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print / Save as PDF
        </Button>
      </div>

      <Card className="print:border-none print:shadow-none">
        <CardContent className="space-y-6 p-8">
          <div className="flex items-start justify-between border-b pb-4">
            <div className="flex items-center gap-3">
              <Image
                src="/images/asian-college-logo.png"
                alt={orgName}
                width={48}
                height={48}
                className="h-12 w-12 shrink-0 object-contain"
              />
              <div>
                <p className="text-lg font-bold text-slate-900">{orgName}</p>
                <p className="text-sm text-muted-foreground">Official Receipt</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Receipt Number</p>
              <p className="text-lg font-bold text-blue-600">{receipt.receiptNumber}</p>
              <Badge variant="outline" className={`mt-1 ${statusMeta.className}`}>
                {statusMeta.label}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Guest" value={receipt.guestName ?? "—"} />
            <Field label="Reservation" value={receipt.reservationNo ?? "—"} />
            {receipt.roomNumber ? (
              <Field
                label="Room"
                value={`${receipt.roomNumber}${receipt.roomTypeName ? ` — ${receipt.roomTypeName}` : ""}${
                  receipt.isSmoking !== null ? ` (${receipt.isSmoking ? "Smoking" : "Non-Smoking"})` : ""
                }`}
              />
            ) : null}
            <Field label="Payment Method" value={receipt.paymentMethod ? receipt.paymentMethod.replaceAll("_", " ") : "—"} />
            <Field
              label="Date / Time"
              value={new Date(receipt.paymentDate).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
            />
            <Field label="Processed By" value={receipt.createdBy} />
            {!hasFolioBreakdown ? <Field label="Description / Purpose" value={receipt.description ?? "—"} /> : null}
          </div>

          {hasFolioBreakdown ? (
            <div className="space-y-1.5 rounded-lg border bg-slate-50/60 p-4">
              <LineItem label="ROOM" value={currency(roomPrice)} />
              {receipt.bedCount ? <LineItem label={`BED (${receipt.bedCount})`} value={currency(bedCharge)} /> : null}
              <div className="my-1.5 border-t border-dashed" />
              <LineItem label="SUBTOTAL" value={currency(Number(receipt.subtotal))} />
              {receipt.discountType && receipt.discountAmount ? (
                <LineItem
                  label={`DISCOUNT: ${DISCOUNT_LABELS[receipt.discountType].toUpperCase()}`}
                  value={`-${currency(Number(receipt.discountAmount))}`}
                  muted
                />
              ) : null}
              <LineItem label="VAT" value={currency(vatAmount)} />
              <div className="my-1.5 border-t" />
              <LineItem label="TOTAL" value={currency(folioTotal)} />
              {balance > 0 ? <LineItem label="REMAINING BALANCE" value={currency(balance)} muted /> : null}
            </div>
          ) : null}

          {receipt.refundOfReceiptNumber ? (
            <p className="rounded-md bg-blue-50 p-3 text-sm text-blue-800">
              This is a refund of receipt <span className="font-semibold">{receipt.refundOfReceiptNumber}</span>.
            </p>
          ) : null}
          {receipt.refundedByReceiptNumber ? (
            <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">
              This payment was refunded via receipt <span className="font-semibold">{receipt.refundedByReceiptNumber}</span>
              {receipt.refundedAt ? ` on ${new Date(receipt.refundedAt).toLocaleDateString()}` : ""}.
            </p>
          ) : null}

          <div className="flex items-center justify-between border-t pt-4">
            <p className="text-sm font-medium text-slate-700">{receipt.type === "REFUND" ? "Amount Refunded" : "Amount Paid"}</p>
            <p className="text-2xl font-bold text-slate-900">{currency(amountPaid)}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
