import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requirePagePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/config/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { getReceiptById } from "@/services/cashiering.service";
import { ReceiptDetail, type ReceiptDetailData } from "@/components/cashiering/receipt-detail";
import { NotFoundError } from "@/lib/errors";

const ORG_NAME = process.env.NEXT_PUBLIC_ORG_NAME || "Front Office Training Center";

export const metadata: Metadata = { title: "Receipt — Front Office Servicing NC II" };

type RouteParams = { params: Promise<{ id: string }> };

export default async function ReceiptDetailPage({ params }: RouteParams) {
  const user = await requirePagePermission(PERMISSIONS.CASHIERING_VIEW);
  if (!user) return <AccessDenied />;

  const { id } = await params;

  let receipt;
  try {
    receipt = await getReceiptById(id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  return <ReceiptDetail receipt={JSON.parse(JSON.stringify(receipt)) as ReceiptDetailData} orgName={ORG_NAME} />;
}
