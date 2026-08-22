"use client";

import { useEffect } from "react";
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
};

const STATUS_META: Record<ReceiptDetailData["status"], { label: string; className: string }> = {
  PAID: { label: "Paid", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  REFUNDED: { label: "Refunded", className: "bg-red-100 text-red-800 border-red-200" },
  REFUND_ISSUED: { label: "Refund Issued", className: "bg-blue-100 text-blue-800 border-blue-200" },
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

export function ReceiptDetail({ receipt, orgName }: { receipt: ReceiptDetailData; orgName: string }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("print") === "1") {
      window.print();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusMeta = STATUS_META[receipt.status];

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
            <div>
              <p className="text-lg font-bold text-slate-900">{orgName}</p>
              <p className="text-sm text-muted-foreground">Official Receipt</p>
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
            <Field label="Trainee / Guest" value={receipt.guestName ?? "—"} />
            <Field label="Reservation" value={receipt.reservationNo ?? "—"} />
            <Field label="Payment Method" value={receipt.paymentMethod ? receipt.paymentMethod.replaceAll("_", " ") : "—"} />
            <Field
              label="Payment Date"
              value={new Date(receipt.paymentDate).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
            />
            <Field label="Created By" value={receipt.createdBy} />
            <Field label="Description / Purpose" value={receipt.description ?? "—"} />
          </div>

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
            <p className="text-2xl font-bold text-slate-900">{currency(Number(receipt.amount))}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
