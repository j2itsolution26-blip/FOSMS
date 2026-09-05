"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatPaymentMethod } from "@/lib/formatters";

export type CombinedReceiptData = {
  reference: string;
  guestName: string;
  membershipNo: string | null;
  membershipFee: number | null;
  membershipPaymentMethod: string | null;
  membershipOtherPaymentMethod: string | null;
  roomChargesTotal: number;
  vatTotal: number;
  discountTotal: number;
  guestChargeTotal: number;
  membershipPaid: number;
  guestPaid: number;
  combinedTotal: number;
  combinedPaid: number;
  balance: number;
  processedBy: string | null;
  date: string;
};

function currency(n: number) {
  return `₱${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function LineItem({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between text-sm ${bold ? "font-bold text-slate-900" : "text-slate-700"}`}>
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-b border-dashed pb-1 text-xs font-semibold tracking-wider text-slate-500 uppercase">{children}</p>
  );
}

export function CombinedReceipt({ receipt, orgName }: { receipt: CombinedReceiptData; orgName: string }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("print") === "1") {
      window.print();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasMembership = receipt.membershipFee !== null;
  const hasGuestCharges = receipt.guestChargeTotal > 0 || receipt.guestPaid > 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link href="/club-reception">
            <ArrowLeft className="h-4 w-4" /> Back to Club Reception
          </Link>
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print / Save as PDF
        </Button>
      </div>

      <Card className="print:border-none print:shadow-none">
        <CardContent className="space-y-5 p-8">
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
                <p className="text-sm text-muted-foreground">Club Reception — Combined Receipt</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Reference</p>
              <p className="text-lg font-bold text-blue-600">{receipt.reference}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Guest / Member</p>
              <p className="font-medium text-slate-900">{receipt.guestName}</p>
            </div>
            {receipt.membershipNo ? (
              <div>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Membership ID</p>
                <p className="font-medium text-slate-900">{receipt.membershipNo}</p>
              </div>
            ) : null}
          </div>

          {hasMembership ? (
            <div className="space-y-1.5">
              <SectionLabel>Membership</SectionLabel>
              <LineItem label="One-Time Membership Fee" value={currency(receipt.membershipFee!)} />
            </div>
          ) : null}

          {hasGuestCharges ? (
            <div className="space-y-1.5">
              <SectionLabel>Guest / Walk-In</SectionLabel>
              <LineItem label="Room Charges" value={currency(receipt.roomChargesTotal)} />
              <LineItem label="VAT" value={currency(receipt.vatTotal)} />
              <LineItem label="Discount" value={`-${currency(receipt.discountTotal)}`} />
            </div>
          ) : null}

          <div className="space-y-1.5 border-t pt-2">
            <LineItem label="TOTAL" value={currency(receipt.combinedTotal)} bold />
          </div>

          <div className="space-y-1.5">
            <SectionLabel>Payments</SectionLabel>
            {hasMembership ? (
              <LineItem
                label={`Membership Payment${
                  receipt.membershipPaymentMethod
                    ? ` (${formatPaymentMethod(receipt.membershipPaymentMethod, receipt.membershipOtherPaymentMethod)})`
                    : ""
                }`}
                value={currency(receipt.membershipPaid)}
              />
            ) : null}
            {hasGuestCharges ? <LineItem label="Guest Payment" value={currency(receipt.guestPaid)} /> : null}
          </div>

          <div className="space-y-1.5 border-t pt-2">
            <LineItem label="TOTAL PAID" value={currency(receipt.combinedPaid)} bold />
            <LineItem label="BALANCE" value={currency(receipt.balance)} bold />
          </div>

          <div className="grid grid-cols-2 gap-4 border-t pt-4 text-sm">
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Front Desk Officer</p>
              <p className="font-medium text-slate-900">{receipt.processedBy || "Not recorded"}</p>
            </div>
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Date</p>
              <p className="font-medium text-slate-900">
                {new Date(receipt.date).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
              </p>
            </div>
          </div>

          <p className="border-t pt-3 text-center text-[11px] text-muted-foreground">
            This is a consolidated view of existing, individually paid transactions. It does not represent a new payment.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
