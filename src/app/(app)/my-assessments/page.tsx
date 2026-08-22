import type { Metadata } from "next";

import { requireOwnTraineePage } from "@/lib/auth/trainee-self";
import { AccessDenied } from "@/components/shared/access-denied";
import { getMyAssessments } from "@/services/trainee-portal.service";
import { MyAssessmentsList } from "@/components/trainee-portal/my-assessments-list";

export const metadata: Metadata = { title: "My Assessments — Front Office Servicing NC II" };

export default async function MyAssessmentsPage() {
  const ctx = await requireOwnTraineePage();
  if (!ctx) return <AccessDenied />;

  const assessments = await getMyAssessments(ctx.trainee.id);
  return <MyAssessmentsList assessments={assessments} />;
}
