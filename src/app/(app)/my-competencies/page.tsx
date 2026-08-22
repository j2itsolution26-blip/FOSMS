import type { Metadata } from "next";

import { requireOwnTraineePage } from "@/lib/auth/trainee-self";
import { AccessDenied } from "@/components/shared/access-denied";
import { getMyCompetencies } from "@/services/trainee-portal.service";
import { MyCompetenciesList } from "@/components/trainee-portal/my-competencies-list";

export const metadata: Metadata = { title: "My Competencies — Front Office Servicing NC II" };

export default async function MyCompetenciesPage() {
  const ctx = await requireOwnTraineePage();
  if (!ctx) return <AccessDenied />;

  const competencies = await getMyCompetencies(ctx.trainee.id);
  return <MyCompetenciesList competencies={competencies} />;
}
