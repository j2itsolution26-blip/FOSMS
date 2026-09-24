"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDiscountRate, formatDiscountType, formatPaymentMethod } from "@/lib/formatters";
import type { FolioStatement } from "@/lib/folio-statement";

export type ReceiptDetailData = {
  id: string;
  receiptNumber: string;
  type: "PAYMENT" | "REFUND";
  status: "PAID" | "REFUNDED" | "REFUND_ISSUED";
  amount: string;
  paymentMethod: string | null;
  otherPaymentMethod: string | null;
  description: string | null;
  paymentDate: string;
  guestName: string | null;
  reservationNo: string | null;
  // Present only for the one-time Club Membership fee — switches the receipt
  // to "CLUB MEMBERSHIP RECEIPT" layout instead of the Guest/Reservation/Room one.
  membership: { membershipNo: string } | null;
  processedBy: string | null;
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
  discountType: "SENIOR_CITIZEN" | "PWD" | "STAKEHOLDER" | "CLUB_MEMBER" | "OTHER" | null;
  otherDiscountType: string | null;
  otherDiscountRate: string | null;
  discountAmount: string | null;
  vatAmount: string | null;
  // A one-time Club Membership fee folded into THIS charge's own VAT/total
  // (see the schema comment on membershipFeeIncluded) — never the separate
  // membership fee PAYMENT itself (that's `membership` above).
  membershipFeeIncluded: string | null;
  // The stay's full itemized folio as of this payment — present on a
  // reservation payment receipt (never on a Club Membership fee receipt).
  folio?: FolioStatement | null;
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

function LineItem({
  label,
  value,
  muted = false,
  strong = false,
}: {
  label: React.ReactNode;
  value: string;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 text-sm ${muted ? "text-muted-foreground" : "text-slate-800"} ${
        strong ? "font-semibold text-slate-900" : ""
      }`}
    >
      <span className="min-w-0 break-words">{label}</span>
      <span className="shrink-0 font-mono">{value}</span>
    </div>
  );
}

/**
 * One signing slot — the role as a heading, a blank line tall enough for a
 * handwritten signature, the signer's recorded name, then the role caption.
 */
function SignatureBlock({ label, name }: { label: string; name: string }) {
  return (
    <div className="min-w-0 break-inside-avoid text-center">
      <p className="text-xs font-medium tracking-wide text-slate-600">{label}</p>
      <div className="h-12 border-b border-slate-900 print:h-16" />
      <p className="mt-1.5 break-words text-sm font-semibold text-slate-900">{name}</p>
      <p className="mt-0.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="pt-1 text-xs font-semibold tracking-wider text-slate-500 uppercase">{children}</p>;
}

/**
 * The stay's whole folio, itemized by source: room charges, each special
 * request by name, other additional charges, and a Club Membership
 * registration fee — never folded into one another.
 */
function FolioBreakdown({ folio, roomTypeName }: { folio: FolioStatement; roomTypeName: string | null }) {
  const discountRate = formatDiscountRate(folio.discount, folio.discountBase, folio.otherDiscountRate);
  return (
    <div className="space-y-1.5 rounded-lg border bg-slate-50/60 p-4">
      {folio.roomLines.length > 0 || folio.bedCharges > 0 ? (
        <>
          <SectionLabel>Room Charges</SectionLabel>
          {folio.roomLines.map((line) => (
            <LineItem key={line.id} label={line.label || roomTypeName || "Room"} value={currency(line.amount)} />
          ))}
          {folio.bedCharges > 0 ? (
            <LineItem label={`Additional Bed${folio.bedCount ? ` (${folio.bedCount})` : ""}`} value={currency(folio.bedCharges)} />
          ) : null}
        </>
      ) : null}

      {folio.specialRequests.length > 0 ? (
        <>
          <SectionLabel>Additional / Special Requests</SectionLabel>
          {folio.specialRequests.map((item) => (
            <div key={item.id} className="text-sm text-slate-800">
              <p className="break-words">{item.itemName}</p>
              <div className="flex items-baseline justify-between gap-4 text-muted-foreground">
                <span className="font-mono text-xs">
                  {item.quantity} × {currency(item.unitPrice)}
                </span>
                <span className="font-mono text-slate-800">{currency(item.total)}</span>
              </div>
            </div>
          ))}
        </>
      ) : null}

      {folio.otherCharges.length > 0 ? (
        <>
          <SectionLabel>Other Additional Charges</SectionLabel>
          {folio.otherCharges.map((line) => (
            <LineItem key={line.id} label={line.label} value={currency(line.amount)} />
          ))}
        </>
      ) : null}

      {folio.membershipFee > 0 ? (
        <>
          <SectionLabel>Club Membership</SectionLabel>
          <LineItem label="Club Membership Registration" value={currency(folio.membershipFee)} />
        </>
      ) : null}

      <div className="my-1.5 border-t border-dashed" />
      <LineItem label="SUBTOTAL" value={currency(folio.subtotal)} />
      {folio.discount > 0 ? (
        <>
          {folio.discountType ? (
            <LineItem label="DISCOUNT TYPE" value={formatDiscountType(folio.discountType, folio.otherDiscountType) ?? "—"} muted />
          ) : null}
          {discountRate ? <LineItem label="DISCOUNT RATE" value={discountRate} muted /> : null}
          <LineItem label="DISCOUNT" value={`-${currency(folio.discount)}`} muted />
        </>
      ) : (
        <LineItem label="DISCOUNT" value={currency(0)} muted />
      )}
      <LineItem label="VAT" value={currency(folio.vat)} />
      <div className="my-1.5 border-t" />
      <LineItem label="TOTAL" value={currency(folio.total)} strong />
      <LineItem label="PAYMENT" value={currency(folio.paid)} />
      <LineItem label="BALANCE" value={currency(Math.max(0, folio.balance))} strong />
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
  // "Amount Paid" is what the guest has paid on this folio IN TOTAL — every
  // payment on the stay up to this receipt, net of refunds (folio.paid, the
  // same figure the breakdown above shows) — never just this one payment's
  // amount. A refund receipt still shows its own amount refunded, and a Club
  // Membership fee receipt its one-time fee (neither carries a folio).
  const totalPaid = receipt.folio ? receipt.folio.paid : amountPaid;
  const bedCharge = receipt.bedCharge ? Number(receipt.bedCharge) : 0;
  const roomPrice = hasFolioBreakdown ? Number(receipt.subtotal) - bedCharge : 0;
  const vatAmount = Number(receipt.vatAmount ?? 0);
  const discountAmount = receipt.discountAmount ? Number(receipt.discountAmount) : 0;
  const membershipFeeIncluded = receipt.membershipFeeIncluded ? Number(receipt.membershipFeeIncluded) : 0;
  // The itemized total reflects the full folio charge, independent of how
  // much of it this particular payment covers — a partial payment shows its
  // own "Amount Paid" plus a remaining balance below, not a shrunken total.
  const folioTotal = hasFolioBreakdown
    ? Number(receipt.subtotal) + membershipFeeIncluded - discountAmount + vatAmount
    : amountPaid;
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
                <p className="text-sm text-muted-foreground">
                  {receipt.membership ? "Club Membership Receipt" : "Official Receipt"}
                </p>
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
            <Field label={receipt.membership ? "Member" : "Guest"} value={receipt.guestName ?? "—"} />
            {receipt.membership ? (
              <Field label="Membership ID" value={receipt.membership.membershipNo} />
            ) : (
              <Field label="Reservation" value={receipt.reservationNo ?? "—"} />
            )}
            {receipt.roomNumber ? (
              <Field
                label="Room"
                value={`${receipt.roomNumber}${receipt.roomTypeName ? ` — ${receipt.roomTypeName}` : ""}${
                  receipt.isSmoking !== null ? ` (${receipt.isSmoking ? "Smoking" : "Non-Smoking"})` : ""
                }`}
              />
            ) : null}
            <Field label="Payment Method" value={formatPaymentMethod(receipt.paymentMethod, receipt.otherPaymentMethod) ?? "—"} />
            <Field
              label="Date / Time"
              value={new Date(receipt.paymentDate).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
            />
            {receipt.membership ? (
              <>
                <Field label="Membership Type" value="Club Member" />
                {/* A membership fee is a single one-time payment (see
                    registerClubMembership()) — never partial, so ACTIVE/PAID
                    here is exactly receipt.status, not a separate flag. */}
                <Field label="Membership Status" value={receipt.status === "PAID" ? "ACTIVE" : statusMeta.label} />
                <Field label="Membership Fee" value={currency(amountPaid)} />
                <Field label="Balance" value={currency(0)} />
              </>
            ) : !hasFolioBreakdown ? (
              <Field label="Description / Purpose" value={receipt.description ?? "—"} />
            ) : null}
          </div>

          {receipt.folio ? (
            <FolioBreakdown folio={receipt.folio} roomTypeName={receipt.roomTypeName} />
          ) : hasFolioBreakdown ? (
            <div className="space-y-1.5 rounded-lg border bg-slate-50/60 p-4">
              {/* A Check-Out Club Membership charge has no room portion. */}
              {roomPrice > 0 || membershipFeeIncluded === 0 ? <LineItem label="ROOM" value={currency(roomPrice)} /> : null}
              {receipt.bedCount ? <LineItem label={`BED (${receipt.bedCount})`} value={currency(bedCharge)} /> : null}
              {membershipFeeIncluded > 0 ? (
                <LineItem label="CLUB MEMBERSHIP REGISTRATION" value={currency(membershipFeeIncluded)} />
              ) : null}
              <div className="my-1.5 border-t border-dashed" />
              <LineItem label="SUBTOTAL" value={currency(Number(receipt.subtotal) + membershipFeeIncluded)} />
              {receipt.discountType && discountAmount > 0 ? (
                <>
                  <LineItem label="DISCOUNT TYPE" value={formatDiscountType(receipt.discountType, receipt.otherDiscountType) ?? "—"} muted />
                  <LineItem
                    label="DISCOUNT RATE"
                    value={formatDiscountRate(receipt.discountAmount, receipt.subtotal, receipt.otherDiscountRate) ?? "—"}
                    muted
                  />
                  <LineItem label="DISCOUNT" value={`-${currency(discountAmount)}`} muted />
                </>
              ) : (
                <LineItem label="DISCOUNT" value="None" muted />
              )}
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

          {/* Amount Paid and the signatures print as one unit, so the
              signature area can never land alone on a separate page. */}
          <div className="space-y-6 break-inside-avoid">
            <div className="flex items-center justify-between border-t pt-4">
              <p className="text-sm font-medium text-slate-700">{receipt.type === "REFUND" ? "Amount Refunded" : "Amount Paid"}</p>
              <p className="text-2xl font-bold text-slate-900">{currency(totalPaid)}</p>
            </div>

            {/* Guest always on the left, Front Desk Officer on the right —
                two fixed equal columns, on screen and in print. */}
            <div className="grid grid-cols-2 gap-8 border-t border-dashed pt-6 sm:gap-12 print:gap-16 print:pt-10">
              <SignatureBlock
                label={receipt.membership ? "Member Signature" : "Guest Signature"}
                name={receipt.guestName ?? "—"}
              />
              <SignatureBlock label="Front Desk Officer Signature" name={receipt.processedBy || "Not recorded"} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
