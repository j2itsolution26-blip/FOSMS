import type { Metadata } from "next";

import { requireOwnTraineePage } from "@/lib/auth/trainee-self";
import { AccessDenied } from "@/components/shared/access-denied";
import { getMyProgress } from "@/services/trainee-portal.service";
import { MyProgressView } from "@/components/trainee-portal/my-progress-view";

export const metadata: Metadata = { title: "My Training Progress — Front Office Servicing NC II" };

export default async function MyProgressPage() {
  const ctx = await requireOwnTraineePage();
  if (!ctx) return <AccessDenied />;

  const progress = await getMyProgress(ctx.trainee.id);
  return <MyProgressView progress={progress} />;
}
