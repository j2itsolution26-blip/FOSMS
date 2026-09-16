import type { Prisma } from "@prisma/client";

/**
 * A stay's running balance from its ledger rows: CHARGE adds, PAYMENT/
 * DISCOUNT/REFUND subtract. The single formula behind reservationBalance()
 * (cashiering.service.ts) and the folio statement.
 */
export function reservationBalanceOf(transactions: { type: string; amount: Prisma.Decimal | number | string }[]) {
  return transactions.reduce((sum, t) => {
    const amount = Number(t.amount);
    if (t.type === "CHARGE") return sum + amount;
    if (t.type === "PAYMENT" || t.type === "DISCOUNT" || t.type === "REFUND") return sum - amount;
    return sum;
  }, 0);
}
