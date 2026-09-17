import type { AdditionalChargeType, DiscountType, Prisma, TransactionType } from "@prisma/client";

import { reservationBalanceOf } from "@/lib/reservation-balance";

type Amount = Prisma.Decimal | number | string;

/** The CashierTransaction fields a stay's folio is itemized from. */
export const folioLedgerSelect = {
  id: true,
  type: true,
  amount: true,
  createdAt: true,
  subtotal: true,
  bedCount: true,
  bedCharge: true,
  discountAmount: true,
  discountType: true,
  otherDiscountType: true,
  otherDiscountRate: true,
  vatAmount: true,
  membershipFeeIncluded: true,
  additionalChargeType: true,
  otherChargeType: true,
  reference: true,
  roomType: { select: { name: true } },
  specialRequest: { select: { id: true, itemName: true, quantity: true, unitPrice: true, lineTotal: true } },
} satisfies Prisma.CashierTransactionSelect;

export type FolioLedgerRow = {
  id: string;
  type: TransactionType | string;
  amount: Amount;
  subtotal: Amount | null;
  bedCount: number | null;
  bedCharge: Amount | null;
  discountAmount: Amount | null;
  discountType: DiscountType | null;
  otherDiscountType: string | null;
  otherDiscountRate: Amount | null;
  vatAmount: Amount | null;
  membershipFeeIncluded: Amount | null;
  additionalChargeType: AdditionalChargeType | null;
  otherChargeType: string | null;
  reference: string | null;
  roomType: { name: string } | null;
  specialRequest: { id: string; itemName: string; quantity: number; unitPrice: Amount; lineTotal: Amount } | null;
};

export type FolioStatement = {
  roomLines: Array<{ id: string; label: string; amount: number }>;
  roomCharges: number;
  bedCount: number;
  bedCharges: number;
  specialRequests: Array<{ id: string; itemName: string; quantity: number; unitPrice: number; total: number }>;
  specialRequestTotal: number;
  // Plain (non-itemized) charges — Check-Out damage/lost item/other charges
  // and manual Cashiering charges.
  otherCharges: Array<{ id: string; label: string; amount: number }>;
  otherChargeTotal: number;
  membershipFee: number;
  subtotal: number;
  discount: number;
  // The room/bed amount the discount was computed on — for the rate display.
  discountBase: number;
  discountType: DiscountType | null;
  otherDiscountType: string | null;
  otherDiscountRate: number | null;
  vat: number;
  total: number;
  paid: number;
  balance: number;
};

const CHARGE_TYPE_LABELS: Record<AdditionalChargeType, string> = {
  DAMAGE: "Damage",
  LOST_ITEM: "Lost Item",
  ADDITIONAL_SERVICE: "Additional Service",
  OTHER: "Other",
  SPECIAL_REQUEST: "Special Request",
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function plainChargeLabel(t: FolioLedgerRow) {
  const type = t.additionalChargeType
    ? t.additionalChargeType === "OTHER" && t.otherChargeType?.trim()
      ? t.otherChargeType.trim()
      : CHARGE_TYPE_LABELS[t.additionalChargeType]
    : null;
  const description = t.reference?.trim() || null;
  if (type && description) return `${type} — ${description}`;
  return type ?? description ?? "Additional Charge";
}

/**
 * Itemizes one stay's ledger into the folio lines shown at Check-Out and on
 * receipts. Every figure comes from persisted CashierTransaction rows, and
 * `total`/`balance` reconcile exactly with reservationBalance():
 * each itemized CHARGE's amount is subtotal − discount + membership fee + VAT,
 * a plain CHARGE's amount is its own line, and DISCOUNT rows reduce the total.
 */
export function buildFolioStatement(transactions: FolioLedgerRow[]): FolioStatement {
  const s: FolioStatement = {
    roomLines: [],
    roomCharges: 0,
    bedCount: 0,
    bedCharges: 0,
    specialRequests: [],
    specialRequestTotal: 0,
    otherCharges: [],
    otherChargeTotal: 0,
    membershipFee: 0,
    subtotal: 0,
    discount: 0,
    discountBase: 0,
    discountType: null,
    otherDiscountType: null,
    otherDiscountRate: null,
    vat: 0,
    total: 0,
    paid: 0,
    balance: 0,
  };

  for (const t of transactions) {
    if (t.type === "DISCOUNT") {
      s.discount += Number(t.amount);
      continue;
    }
    if (t.type !== "CHARGE") continue;

    if (t.additionalChargeType === "SPECIAL_REQUEST") {
      const total = t.subtotal != null ? Number(t.subtotal) : Number(t.amount) - Number(t.vatAmount ?? 0);
      s.specialRequests.push({
        id: t.specialRequest?.id ?? t.id,
        itemName: t.specialRequest?.itemName ?? t.reference ?? "Special Request",
        quantity: t.specialRequest?.quantity ?? 1,
        unitPrice: t.specialRequest ? Number(t.specialRequest.unitPrice) : total,
        total,
      });
      s.specialRequestTotal += total;
      s.discount += Number(t.discountAmount ?? 0);
      s.vat += Number(t.vatAmount ?? 0);
      continue;
    }

    if (t.subtotal == null) {
      const amount = Number(t.amount);
      s.otherCharges.push({ id: t.id, label: plainChargeLabel(t), amount });
      s.otherChargeTotal += amount;
      continue;
    }

    const bed = Number(t.bedCharge ?? 0);
    const room = Number(t.subtotal) - bed;
    if (room > 0 || t.roomType) {
      s.roomLines.push({ id: t.id, label: t.roomType?.name ?? "Room", amount: room });
      s.roomCharges += room;
    }
    s.bedCharges += bed;
    s.bedCount += t.bedCount ?? 0;
    s.membershipFee += Number(t.membershipFeeIncluded ?? 0);
    const discount = Number(t.discountAmount ?? 0);
    s.discount += discount;
    if (discount > 0) {
      s.discountBase += Number(t.subtotal);
      s.discountType ??= t.discountType;
      s.otherDiscountType ??= t.otherDiscountType;
      s.otherDiscountRate ??= t.otherDiscountRate != null ? Number(t.otherDiscountRate) : null;
    }
    s.vat += Number(t.vatAmount ?? 0);
  }

  s.subtotal = s.roomCharges + s.bedCharges + s.specialRequestTotal + s.otherChargeTotal + s.membershipFee;
  s.total = s.subtotal - s.discount + s.vat;
  s.balance = reservationBalanceOf(transactions);
  s.paid = s.total - s.balance;

  for (const key of [
    "roomCharges",
    "bedCharges",
    "specialRequestTotal",
    "otherChargeTotal",
    "membershipFee",
    "subtotal",
    "discount",
    "discountBase",
    "vat",
    "total",
    "paid",
    "balance",
  ] as const) {
    s[key] = round2(s[key]);
  }
  return s;
}
