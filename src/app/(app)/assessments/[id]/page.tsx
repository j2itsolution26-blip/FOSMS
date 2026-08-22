import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requirePagePermission } from "@/lib/auth/require-permission";
import { hasPermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/config/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { getAssessmentById } from "@/services/assessment.service";
import { AssessmentDetail, type AssessmentDetailData } from "@/components/assessments/assessment-detail";
import { NotFoundError } from "@/lib/errors";

export const metadata: Metadata = { title: "Assessment — Front Office Servicing NC II" };

type RouteParams = { params: Promise<{ id: string }> };

export default async function AssessmentDetailPage({ params }: RouteParams) {
  const user = await requirePagePermission(PERMISSIONS.ASSESSMENTS_VIEW);
  if (!user) return <AccessDenied />;

  const { id } = await params;

  let assessment;
  try {
    assessment = await getAssessmentById(id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  return (
    <AssessmentDetail
      assessment={JSON.parse(JSON.stringify(assessment)) as AssessmentDetailData}
      canEvaluate={hasPermission(user, PERMISSIONS.ASSESSMENTS_EVALUATE)}
      canFinalize={hasPermission(user, PERMISSIONS.ASSESSMENTS_FINALIZE)}
    />
  );
}
