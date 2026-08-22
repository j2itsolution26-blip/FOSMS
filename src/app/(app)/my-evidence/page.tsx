import type { Metadata } from "next";

import { requireOwnTraineePage } from "@/lib/auth/trainee-self";
import { AccessDenied } from "@/components/shared/access-denied";
import { getMyEvidence } from "@/services/trainee-portal.service";
import { MyEvidenceList } from "@/components/trainee-portal/my-evidence-list";

export const metadata: Metadata = { title: "Evidence & Documents — Front Office Servicing NC II" };

export default async function MyEvidencePage() {
  const ctx = await requireOwnTraineePage();
  if (!ctx) return <AccessDenied />;

  const evidence = await getMyEvidence(ctx.trainee.id);
  return <MyEvidenceList evidence={evidence} />;
}
