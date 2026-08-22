import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requirePagePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/config/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { getCompetencyById } from "@/services/competency.service";
import { CompetencyDetail, type CompetencyDetailData } from "@/components/competencies/competency-detail";
import { NotFoundError } from "@/lib/errors";

export const metadata: Metadata = { title: "Competency Details — Front Office Servicing NC II" };

type RouteParams = { params: Promise<{ id: string }> };

export default async function CompetencyDetailPage({ params }: RouteParams) {
  const user = await requirePagePermission(PERMISSIONS.COMPETENCIES_VIEW);
  if (!user) return <AccessDenied />;

  const { id } = await params;

  let competency;
  try {
    competency = await getCompetencyById(id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  return <CompetencyDetail competency={JSON.parse(JSON.stringify(competency)) as CompetencyDetailData} />;
}
