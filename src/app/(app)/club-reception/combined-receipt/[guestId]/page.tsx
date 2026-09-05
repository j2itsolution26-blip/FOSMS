import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requirePagePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/config/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { getGuestFinancialHistory } from "@/services/club-membership.service";
import { CombinedReceipt, type CombinedReceiptData } from "@/components/club-reception/combined-receipt";
import { formatGuestFullName } from "@/lib/formatters";
import { NotFoundError } from "@/lib/errors";

const ORG_NAME = process.env.NEXT_PUBLIC_ORG_NAME || "Front Office Training Center";

export const metadata: Metadata = { title: "Combined Receipt — Front Office Servicing NC II" };

type RouteParams = { params: Promise<{ guestId: string }> };

export default async function CombinedReceiptPage({ params }: RouteParams) {
  const user = await requirePagePermission(PERMISSIONS.CLUB_RECEPTION_VIEW);
  if (!user) return <AccessDenied />;

  const { guestId } = await params;

  let history;
  try {
    history = await getGuestFinancialHistory(guestId);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  // "Whoever was at the desk last" — the most recent of the membership
  // payment's and the guest's own transactions' Front Desk Officers, since
  // each transaction keeps its own separate value (never merged/copied) and
  // a combined receipt still needs exactly one name to print.
  const candidates = [
    history.membership?.transaction
      ? { processedBy: history.membership.transaction.processedBy, at: history.membership.transaction.createdAt }
      : null,
    ...history.guestTransactions
      .filter((t) => t.type === "PAYMENT" && !t.reversedById)
      .map((t) => ({ processedBy: t.processedBy, at: t.createdAt })),
  ].filter((c): c is { processedBy: string | null; at: Date } => !!c);
  candidates.sort((a, b) => b.at.getTime() - a.at.getTime());
  const processedBy = candidates[0]?.processedBy ?? null;

  const reference = `COMBINED-${new Date().getFullYear()}-${(history.membership?.membershipNo.replace(/\D/g, "") ?? guestId.slice(-6).toUpperCase())}`;

  const guestPaid = history.breakdown.guestPaidTotal;

  const data: CombinedReceiptData = {
    reference,
    guestName: formatGuestFullName(history.guest),
    membershipNo: history.membership?.membershipNo ?? null,
    membershipFee: history.membership ? history.membership.feeAmount : null,
    membershipPaymentMethod: history.membership?.transaction?.paymentMethod ?? null,
    membershipOtherPaymentMethod: history.membership?.transaction?.otherPaymentMethod ?? null,
    roomChargesTotal: history.breakdown.roomChargesTotal,
    vatTotal: history.breakdown.vatTotal,
    discountTotal: history.breakdown.discountTotal,
    guestChargeTotal: history.breakdown.guestChargeTotal,
    membershipPaid: history.breakdown.membershipPaid,
    guestPaid,
    combinedTotal: history.breakdown.combinedTotal,
    combinedPaid: history.breakdown.combinedPaid,
    balance: history.breakdown.balance,
    processedBy,
    date: new Date().toISOString(),
  };

  return <CombinedReceipt receipt={data} orgName={ORG_NAME} />;
}
